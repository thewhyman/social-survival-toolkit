"use client";

import { useState } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upgrade() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to start checkout");
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <a href="/">← Back</a>
      <h1 style={{ marginTop: 12 }}>Billing</h1>

      <SignedOut>
        <p>Please sign in to upgrade.</p>
        <a href="/sign-in">Sign in</a>
      </SignedOut>

      <SignedIn>
        <p>Upgrade to Pro.</p>
        <button
          onClick={upgrade}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #444" }}
        >
          {loading ? "Redirecting…" : "Go Pro"}
        </button>
        {err && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#2b0f12", color: "#ffd7dc" }}>
            {err}
          </div>
        )}
      </SignedIn>
    </main>
  );
}