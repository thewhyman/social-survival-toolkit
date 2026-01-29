"use client";

import { useState } from "react";

type SendCheckResult = {
  risk_level: "Low" | "Medium" | "High";
  flags: string[];
  recommendation: "Send" | "Rewrite" | "Wait 24 hours";
  safer_version: string; // empty if recommendation === "Send"
};

export default function SendCheckPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const copyText =
    result?.recommendation === "Send"
      ? input
      : (result?.safer_version || "");

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>← Back</a>

      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Tell me if I’m about to regret sending this</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste your drafted message here…"
        rows={10}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button
          onClick={run}
          disabled={loading || input.trim().length < 3}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#eee" : "#111",
            color: loading ? "#111" : "#fff",
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
            setCopied(false);
          }}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", color: "#111" }}
        >
          Clear
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fff3f3", border: "1px solid #ffd0d0" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 10,
            border: "1px solid #eee",
            background: "#f7f7f7",
            color: "#111",
            display: "grid",
            gap: 10,
          }}
        >
          <div>
            <strong>Risk level:</strong> {result.risk_level}
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
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                cursor: copyText ? "pointer" : "not-allowed",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <p style={{ marginTop: 16, color: "var(--foreground)", opacity: 0.7, fontSize: 13 }}>
        Don’t paste secrets or PHI.
      </p>
    </main>
  );
}