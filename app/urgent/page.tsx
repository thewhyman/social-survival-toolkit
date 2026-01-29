"use client";

import { useState } from "react";

type UrgentResult = {
  label: string;
  why: string;
  suggested_reply: string;
};

export default function UrgentPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UrgentResult | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const r = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          mode: "urgent",
        }),
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

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>← Back</a>

      <h1 style={{ fontSize: 28, marginBottom: 12 }}>
        Is this urgent or just loud?
      </h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste the message here…"
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
          {loading ? "Checking…" : "Check urgency"}
        </button>

        <button
          onClick={() => {
            setInput("");
            setResult(null);
            setError(null);
          }}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
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
          }}
        >
          <h2 style={{ marginBottom: 8 }}>{result.label}</h2>

          <p style={{ marginBottom: 12 }}>{result.why}</p>

          <strong>Suggested reply:</strong>
          <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
            {result.suggested_reply}
          </div>
        </div>
      )}
    </main>
  );
}