import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

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

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/* ---------------- Rate Limiter (MVP, in-memory) ----------------
   Windows are rolling.
   Anonymous:
     - 3 / minute
     - 5 / day
   Signed-in:
     - 10 / minute
     - 50 / day
------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };

const buckets1m = new Map<string, Bucket>();
const buckets1d = new Map<string, Bucket>();

const WINDOW_1M_MS = 60_000;
const WINDOW_1D_MS = 86_400_000;

const ANON_PER_MIN = 3;
const ANON_PER_DAY = 5;

const SIGNED_IN_FREE_PER_MIN = 10;
const SIGNED_IN_FREE_PER_DAY = 50;

const SIGNED_IN_PRO_PER_MIN = 100;
const SIGNED_IN_PRO_PER_DAY = 1000;



function consume(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const b = map.get(key);

  if (!b || now > b.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetInMs: windowMs, limit };
  }

  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetInMs: b.resetAt - now, limit };
  }

  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetInMs: b.resetAt - now, limit };
}

/* ---------------- Route ---------------- */

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { userId } = await auth();

    let plan: "free" | "pro" = "free";
    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      if (user.publicMetadata?.plan === "pro") plan = "pro";
    }

    const perMinLimit = userId
      ? plan === "pro"
        ? SIGNED_IN_PRO_PER_MIN
        : SIGNED_IN_FREE_PER_MIN
      : ANON_PER_MIN;

    const perDayLimit = userId
      ? plan === "pro"
        ? SIGNED_IN_PRO_PER_DAY
        : SIGNED_IN_FREE_PER_DAY
      : ANON_PER_DAY;

    // Stable identity key
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    /* ---- Per-minute limit ---- */
    const rlMin = consume(buckets1m, `1m:${key}`, perMinLimit, WINDOW_1M_MS);

    if (!rlMin.ok) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded (per minute). Try again shortly.",
          retry_after_ms: rlMin.resetInMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rlMin.resetInMs / 1000)),
            "X-RateLimit-Window": "1m",
            "X-RateLimit-Limit": String(rlMin.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    /* ---- Per-day limit (both anon + signed-in) ---- */
    const rlDay = consume(buckets1d, `1d:${key}`, perDayLimit, WINDOW_1D_MS);

    if (!rlDay.ok) {
      return NextResponse.json(
        {
          error: userId
            ? "Daily limit reached. Come back tomorrow."
            : "Daily limit reached. Sign up for more.",
          retry_after_ms: rlDay.resetInMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rlDay.resetInMs / 1000)),
            "X-RateLimit-Window": "1d",
            "X-RateLimit-Limit": String(rlDay.limit),
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
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
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
You are a "send check" assistant.
Help the user avoid sending messages they will regret.
`.trim();

      schemaName = "send_check";
      schema = {
        type: "object",
        properties: {
          risk_level: { type: "string", enum: ["Low", "Medium", "High"] },
          flags: { type: "array", items: { type: "string" }, maxItems: 4 },
          recommendation: { type: "string", enum: ["Send", "Rewrite", "Wait 24 hours"] },
          safer_version: { type: "string" },
        },
        required: ["risk_level", "flags", "recommendation", "safer_version"],
        additionalProperties: false,
      };
    } else {
      system = `
Rewrite the user's message in 3 variants:
Polite, Neutral, Warm.
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

    /* ---- OpenAI ---- */
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
      return NextResponse.json({ error: text }, { status: 500 });
    }

    const data = await r.json();
    const raw = extractOutputText(data);
    const parsed = JSON.parse(raw);

    return NextResponse.json(
      { result: parsed },
      {
        headers: {
          "X-RateLimit-1m-Limit": String(rlMin.limit),
          "X-RateLimit-1m-Remaining": String(rlMin.remaining),
          "X-RateLimit-1d-Limit": String(rlDay.limit),
          "X-RateLimit-1d-Remaining": String(rlDay.remaining),
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}