"use client";

import { useState } from "react";

type RewriteResult = {
    polite: string;
    neutral: string;
    warm: string;
};

export default function RewritePage() {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<RewriteResult | null>(null);

    async function run() {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const r = await fetch("/api/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input }),
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

    function copy(text: string) {
        navigator.clipboard.writeText(text);
    }

    return (
        <main style={{ maxWidth: 760, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
            <a href="/" style={{ display: "inline-block", marginBottom: 12 }}>← Back</a>

            <h1 style={{ fontSize: 28, marginBottom: 12 }}>Rewrite this so I don’t sound like a jerk</h1>

            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your message here…"
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
                    {loading ? "Rewriting…" : "Rewrite"}
                </button>

                <button
                    onClick={() => {
                        setInput("");
                        setResult(null);
                        setError(null);
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
                <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                  {(["polite", "neutral", "warm"] as const).map((k) => (
                    <div
                      key={k}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid #eee",
                        background: "#f7f7f7",
                        color: "#111",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ textTransform: "capitalize", color: "#111" }}>{k}</strong>
              
                        <button
                          onClick={() => copy(result[k])}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            color: "#111",
                            cursor: "pointer",
                          }}
                        >
                          Copy
                        </button>
                      </div>
              
                      <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#111" }}>
                        {result[k]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </main>
    );
}