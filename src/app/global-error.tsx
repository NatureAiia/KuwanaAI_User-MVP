"use client";

// Only fires if the root layout itself throws — everything else is caught by
// error.tsx. Deliberately minimal and independent of next/font/globals.css:
// if the root layout is broken, this shouldn't assume anything else works.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f172a",
          color: "#f8fafc",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: 700 }}>Kuwana hit a snag</h1>
        <p style={{ marginTop: "8px", maxWidth: "320px", color: "#94a3b8", fontSize: "14px" }}>
          Something went wrong loading the app. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            borderRadius: "12px",
            background: "#38bdf8",
            color: "#0b1512",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
