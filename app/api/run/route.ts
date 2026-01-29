import { NextRequest, NextResponse } from "next/server";

type Mode = "rewrite" | "urgent" | "send_check";

/* ---------------- Utilities ---------------- */

function clampText(s: string, maxChars: number) {
  s = (s || "").trim();
  if (s.length > maxChars) s = s.slice(0, maxChars);
  return s;
}

function extractOutputText(data: any): string {
  return (
    data?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ??
    data?.output_text ??
    ""
  );
}

/* ---------------- Rate Limiter (MVP) ---------------- */
// Best-effort, in-memory limiter. Good enough for MVP.
// Upgrade later to Redis / Vercel KV if needed.

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQ = 10;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimit(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip);

  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, remaining: RATE_LIMIT_MAX_REQ - 1, resetInMs: RATE_LIMIT_WINDOW_MS };
  }

  if (b.count >= RATE_LIMIT_MAX_REQ) {
    return { ok: false, remaining: 0, resetInMs: b.resetAt - now };
  }

  b.count += 1;
  return { ok: true, remaining: RATE_LIMIT_MAX_REQ - b.count, resetInMs: b.resetAt - now };
}

/* ---------------- Route ---------------- */

export async function POST(req: NextRequest) {
  try {
    /* ---- Rate limit ---- */
    const ip = getClientIp(req);
    const rl = rateLimit(ip);

    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Try again shortly.",
          retry_after_ms: rl.resetInMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rl.resetInMs / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQ),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    /* ---- Input ---- */
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

    /* ---- Prompt + Schema ---- */
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
You are a "send check" assistant. Help the user avoid sending messages they will regret.

Rules:
- Be practical and non-judgmental.
- Flag tone, escalation, permanence, or power imbalance.
- Keep safer rewrites close to original meaning.
- If recommendation is "Send", safer_version must be empty.
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
- Keep the same intent and content.
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

    /* ---- OpenAI call ---- */
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
        { error: "Model returned non-JSON", raw },
        { status: 500 }
      );
    }

    /* ---- Success ---- */
    return NextResponse.json(
      { result: parsed },
      {
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQ),
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}