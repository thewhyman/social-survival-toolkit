export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Social Survival Toolkit</h1>
      <p>Paste a message. Get the least-wrong next move.</p>

      <ul>
      <li><a href="/rewrite" style={{ display: "inline-block", marginTop: 12 }}>
        ✏️ Rewrite so I don’t sound like a jerk
        </a></li>
        
        <li><a href="/urgent">🚨 Is this urgent or just loud?</a></li>
        <li><a href="/send-check">⚠️ Am I about to regret sending this?</a></li>
      </ul>
    </main>
  );
}