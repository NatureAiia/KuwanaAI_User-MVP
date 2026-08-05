"use client";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself,
 * which `error.tsx` sits inside and therefore cannot catch.
 *
 * This one replaces the entire document, so it has to render its own <html>
 * and <body> — the root layout is exactly what failed. That also means none
 * of the app's fonts, CSS variables, or Tailwind layer are guaranteed to
 * have loaded, so the styling here is inline and self-contained rather than
 * class-based. A boundary that depends on the thing it is catching for is
 * not a boundary.
 *
 * The most likely way to reach this page in this app is a missing Supabase
 * environment variable, which proxy.ts throws on by design.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0B0F14",
          color: "#E6EDF3",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Kuwana is temporarily unavailable</h1>
        <p style={{ maxWidth: "44ch", lineHeight: 1.6, color: "#9BA8B4", margin: 0 }}>
          We hit an error while loading the app. Please try again in a moment.
        </p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#6B7A88", margin: 0 }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem 1.5rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "#0B0F14",
            background: "#38BDF8",
            border: "none",
            borderRadius: "0.75rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
