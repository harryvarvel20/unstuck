"use client";

/**
 * Root error boundary — catches failures in the layout itself. Must render its
 * own <html>/<body>. Deliberately dependency-free and inline-styled so it works
 * even if something upstream is broken.
 */
export default function GlobalError({
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
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F0E6",
          color: "#1B2531",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌫️</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
            Something wobbled — and it&apos;s on us, not you.
          </h1>
          <p style={{ color: "#5C5648", marginTop: 12 }}>
            The app hit a snag. Give it another go.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              backgroundColor: "#0F1F34",
              color: "#F5F0E6",
              border: "none",
              borderRadius: 16,
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
