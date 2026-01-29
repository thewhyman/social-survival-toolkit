import { NextRequest, NextResponse } from "next/server";

function clampText(s: string, maxChars: number) {
    s = (s || "").trim();
    if (s.length > maxChars) s = s.slice(0, maxChars);
    return s;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const inputRaw = String(body?.input ?? "");
        const input = clampText(inputRaw, 6000);

        if (input.length < 3) {
            return NextResponse.json({ error: "Input too short" }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing OPENAI_API_KEY on server" }, { status: 500 });
        }

        const system = `
You are a communication rewrite assistant.
Rewrite the user's message in 3 variants: Polite, Neutral, Warm.

Rules:
- Keep the same intent and content (do not add new commitments).
- Keep it concise.
- Avoid corporate fluff.
`.trim();

        const r = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // IMPORTANT: use a model that supports json_schema structured outputs
                model: "gpt-4o-mini",
                input: [
                    { role: "system", content: system },
                    { role: "user", content: input },
                ],
                max_output_tokens: 450,

                // IMPORTANT: enforce schema
                text: {
                    format: {
                        type: "json_schema",
                        name: "rewrite_variants",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                polite: { type: "string" },
                                neutral: { type: "string" },
                                warm: { type: "string" },
                            },
                            required: ["polite", "neutral", "warm"],
                            additionalProperties: false,
                        },
                    },
                },
            }),
        });

        if (!r.ok) {
            const text = await r.text();
            return NextResponse.json({ error: `OpenAI error: ${text}` }, { status: 500 });
        }

        const data = await r.json();
        console.log("FULL OPENAI RESPONSE:", JSON.stringify(data, null, 2));
        // With structured outputs, output_text should be valid JSON matching the schema
        const raw =
            data.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ??
            data.output_text ??
            "";

        if (!raw) {
            return NextResponse.json({ error: "Empty model output", data }, { status: 500 });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: "Model returned non-JSON", raw }, { status: 500 });
        }

        return NextResponse.json({ result: parsed });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
    }
}