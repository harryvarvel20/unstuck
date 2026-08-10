import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Branded OpenGraph/Twitter share image (1200×630). */
export function GET(): Response {
  const peach = "#C7A770";
  const bg = "#0F1F34";
  const text = "#F5F0E6";
  const muted = "#C7BFAF";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: bg,
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", fontSize: 44, fontWeight: 700, color: text }}
      >
        ADH<span style={{ color: peach }}>V</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 68,
            fontWeight: 700,
            color: text,
            lineHeight: 1.15,
            maxWidth: 1000,
          }}
        >
          The app that gets you started when your brain won&apos;t — and sits
          with you until it&apos;s done.
        </span>
      </div>

      <div style={{ display: "flex", fontSize: 32, color: muted }}>
        AI body double · a plan that learns your real pace · a reset for bad
        days
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
