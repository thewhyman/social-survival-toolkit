import { NextRequest, NextResponse } from "next/server";

type Mode = "rewrite" | "urgent" | "send_check";

function clampText(s: string, maxChars: number) {
  s = (s || "").trim();
  if (s.length > maxChars) s = s.slice(0, maxChars);
  return s;
}

function extractOutputText(data: any): string {
  // Reliable for Responses API
  const t =
    data?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ??
    data?.output_text ??
    "";
  return typeof t === "string" ? t : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const inputRaw = String(body?.input ?? "");
    const input = clampText(inputRaw, 6000);

    const mode: Mode = (body?.mode ?? "rewrite") as Mode;
    if (!["rewrite", "urgent", "send_check"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (input.length < 3) {
      return NextResponse.json({ error: "Input too short" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on server" },
        { status: 500 }
      );
    }

    let system = "";
    let schema: any = {};
    let schemaName = "";

    if (mode === "urgent") {
      system = `
You assess urgency calmly and practically.
Classify the message and provide perspective.

Labels (choose one exactly):
- Truly urgent
- Artificial urgency
- Someone else's stress
- Need more context

Be concise and non-alarmist.
`.trim();

      schemaName = "urgent_triage";
      schema = {
        type: "object",
        properties: {
          label: { type: "string" },
          why: { type: "string" },
          suggested_reply: { type: "string" },
        },
        required: ["label", "why", "suggested_reply"],
        additionalProperties: false,
      };
    } else if (mode === "send_check") {
      system = `
You are a "send check" assistant. You help the user avoid sending messages they will regret.

Rules:
- Be practical and non-judgmental.
- Flag likely regret triggers (tone, escalation, permanence, power imbalance).
- Keep the safer rewrite close to the original meaning.
- If recommendation is "Send", safer_version must be an empty string.
`.trim();

      schemaName = "send_check";
      schema = {
        type: "object",
        properties: {
          risk_level: { type: "string", enum: ["Low", "Medium", "High"] },
          flags: { type: "array", items: { type: "string" }, maxItems: 4 },
          recommendation: {
            type: "string",
            enum: ["Send", "Rewrite", "Wait 24 hours"],
          },
          safer_version: { type: "string" },
        },
        required: ["risk_level", "flags", "recommendation", "safer_version"],
        additionalProperties: false,
      };
    } else {
      system = `
You are a communication rewrite assistant.
Rewrite the user's message in 3 variants: Polite, Neutral, Warm.

Rules:
- Keep the same intent and content (do not add new commitments).
- Keep it concise.
- Avoid corporate fluff.
`.trim();

      schemaName = "rewrite_variants";
      schema = {
        type: "object",
        properties: {
          polite: { type: "string" },
          neutral: { type: "string" },
          warm: { type: "string" },
        },
        required: ["polite", "neutral", "warm"],
        additionalProperties: false,
      };
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: input },
        ],
        max_output_tokens: 450,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: `OpenAI error: ${text}` }, { status: 500 });
    }

    const data = await r.json();

    const raw = extractOutputText(data);
    if (!raw) {
      return NextResponse.json({ error: "Empty model output", data }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw, data },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}