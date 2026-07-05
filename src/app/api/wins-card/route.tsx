import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getWeekWins } from "@/lib/wins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/wins-card — the shareable weekly-wins image (1080×1350, 4:5).
 * Counts only by default; ?detail=1 opts in to including the hardest-thing
 * text. Data is derived server-side from the signed-in user — nothing in the
 * URL can forge someone's numbers.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return new Response("unavailable", { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.plan !== "pro") {
    return new Response("pro required", { status: 402 });
  }

  const wins = await getWeekWins(supabase, user.id);
  const detail = req.nextUrl.searchParams.get("detail") === "1";

  const peach = "#C7A770";
  const bg = "#0F1F34";
  const surface = "#16233A";
  const text = "#F5F0E6";
  const muted = "#C7BFAF";

  const stat = (value: string, label: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: surface,
        borderRadius: 36,
        padding: "36px 44px",
        flexGrow: 1,
      }}
    >
      <span style={{ fontSize: 88, fontWeight: 700, color: peach }}>
        {value}
      </span>
      <span style={{ fontSize: 30, color: muted, marginTop: 6 }}>{label}</span>
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: bg,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: text }}>
          ADH<span style={{ color: peach }}>V</span>
        </span>
        <span style={{ fontSize: 28, color: muted, marginLeft: "auto" }}>
          my week
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 90,
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: text,
            lineHeight: 1.15,
          }}
        >
          Started {wins.startedCount}{" "}
          {wins.startedCount === 1 ? "thing" : "things"} my brain said no to.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 28,
          marginTop: 80,
        }}
      >
        {stat(String(wins.stepsDone), "tiny steps done")}
        {stat(String(wins.focusMinutes), "minutes showed up")}
      </div>

      {detail && wins.hardestTitle ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: surface,
            borderRadius: 36,
            padding: "36px 44px",
            marginTop: 28,
          }}
        >
          <span style={{ fontSize: 28, color: muted }}>
            hardest thing I started
          </span>
          <span
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: text,
              marginTop: 10,
            }}
          >
            {wins.hardestTitle.slice(0, 90)}
          </span>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          marginTop: "auto",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 30, color: muted }}>
          no streaks · no guilt · just starts
        </span>
        <span style={{ fontSize: 30, color: peach }}>getunstuck</span>
      </div>
    </div>,
    { width: 1080, height: 1350 },
  );
}
