import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Generated app icon (the "U" mark) at the requested size. PNG output. */
export function GET(req: NextRequest): Response {
  const size = Math.min(
    512,
    Math.max(48, Number(req.nextUrl.searchParams.get("size")) || 512),
  );
  const maskable = req.nextUrl.searchParams.get("maskable") === "1";
  const pad = maskable ? Math.round(size * 0.12) : 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0F1F34",
        borderRadius: maskable ? 0 : size * 0.22,
        padding: pad,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: size * 0.58,
          fontWeight: 700,
          color: "#F5F0E6",
          fontFamily: "sans-serif",
        }}
      >
        A
      </div>
    </div>,
    { width: size, height: size },
  );
}
