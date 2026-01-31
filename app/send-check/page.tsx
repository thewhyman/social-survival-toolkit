"use client";

import { useState } from "react";

type SendCheckResult = {
  risk_level: "Low" | "Medium" | "High";
  flags: string[];
  recommendation: "Send" | "Rewrite" | "Wait 24 hours";
  safer_version: string;
};

type LimitInfo = {
  mLimit?: number;
  mRemaining?: number;
  dLimit?: number;
  dRemaining?: number;
};

function parseLimits(r: Response): LimitInfo {
  const toNum = (v: string | null) => (v == null ? undefined : Number(v));
  return {
    mLimit: toNum(r.headers.get("X-RateLimit-1m-Limit")),
    mRemaining: toNum(r.headers.get("X-RateLimit-1m-Remaining")),
    dLimit: toNum(r.headers.get("X-RateLimit-1d-Limit")),
    dRemaining: toNum(r.headers.get("X-RateLimit-1d-Remaining")),
  };
}

function LimitsBar({ limits }: { limits: LimitInfo | null }) {
  if (!limits) return null;
  const parts: string[] = [];
  if (limits.mLimit != null && limits.mRemaining != null) parts.push(`Minute: ${limits.mRemaining}/${limits.mLimit}`);
  if (limits.dLimit != null && limits.dRemaining != null) parts.push(`Day: ${limits.dRemaining}/${limits.dLimit}`);
  if (!parts.length) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#141414",
        color: "#f3f3f3",
        fontSize: 13,
      }}
    >
      {parts.join(" • ")}
    </div>
  );
}

export default function SendCheckPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<LimitInfo | null>(null);

  const [result, setResult] = useState<SendCheckResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const r = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: "send_check" }),
      });

      setLimits(parseLimits(r));

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Request failed");
      setResult(data.result);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  const copyText = result?.recommendation === "Send" ? input : result?.safer_version || "";

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>
        ← Back
      </a>

      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Send-check</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste your drafted message here…"
        rows={10}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #444", background: "transparent" }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button
          onClick={run}
          disabled={loading || input.trim().length < 3}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#222" : "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking…" : "Check message"}
        </button>

        <button
          onClick={() => {
            setInput("");
            setResult(null);
            setError(null);
            setLimits(null);
            setCopied(false);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #444",
            background: "transparent",
            color: "var(--foreground)",
          }}
        >
          Clear
        </button>
      </div>

      <LimitsBar limits={limits} />

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#2b0f12",
            border: "1px solid #5a1b22",
            color: "#ffd7dc",
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 10,
            border: "1px solid #333",
            background: "#141414",
            color: "#f3f3f3",
            display: "grid",
            gap: 10,
          }}
        >
          <div>
            <strong>Risk:</strong> {result.risk_level}
          </div>
          <div>
            <strong>Recommendation:</strong> {result.recommendation}
          </div>

          {result.flags?.length > 0 && (
            <div>
              <strong>Flags:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {result.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendation !== "Send" && result.safer_version && (
            <div>
              <strong>Safer version:</strong>
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{result.safer_version}</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={() => copy(copyText)}
              disabled={!copyText}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #444",
                background: "#0f0f0f",
                color: "#fff",
                cursor: copyText ? "pointer" : "not-allowed",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}