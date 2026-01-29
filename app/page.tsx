export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Social Survival Toolkit</h1>
      <p>Paste a message. Get the least-wrong next move.</p>

      <ul>
        <li>✏️ Rewrite so I don’t sound like a jerk</li>
        <a href="/rewrite" style={{ display: "inline-block", marginTop: 12 }}>
          Go to Rewrite Tool →
        </a>
        <li>🚨 Is this urgent or just loud?</li>
        <li>⚠️ Am I about to regret sending this?</li>
      </ul>
    </main>
  );
}