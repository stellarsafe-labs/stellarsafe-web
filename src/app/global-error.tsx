"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>StellarSafe failed to load</h1>
          <p style={{ color: "#666" }}>No transaction was signed. Please try again.</p>
          <button
            onClick={reset}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
