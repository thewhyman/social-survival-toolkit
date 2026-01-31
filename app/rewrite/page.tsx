"use client";

import { useState } from "react";

export default function RewritePage() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setErr(null);
    setOut(null);

    try {
      const r = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: "rewrite" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Request failed");
      setOut(data.result);
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <a href="/">← Back</a>
      <h1 style={{ marginTop: 12 }}>Rewrite</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        style={{ width: "100%", marginTop: 12, padding: 12 }}
      />

      <button
        onClick={run}
        disabled={loading || input.trim().length < 3}
        style={{ marginTop: 12, padding: "10px 14px" }}
      >
        {loading ? "Working…" : "Rewrite"}
      </button>

      {err && <p style={{ marginTop: 12 }}>{err}</p>}

      {out && (
        <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </main>
  );
}