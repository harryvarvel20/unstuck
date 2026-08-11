import { getServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 10;
export const dynamic = "force-dynamic";

/**
 * GET /api/health — machine-readable liveness check (AA5).
 *
 * Exists so an external uptime monitor can detect a real outage. Pinging `/`
 * is not sufficient: the marketing page is statically generated and served
 * from the CDN, so it keeps returning 200 long after the database has gone
 * away and every signed-in user is broken. This endpoint deliberately
 * exercises the path that actually matters — function → Supabase — and fails
 * loudly when it breaks.
 *
 * Returns 200 when healthy and **503** when not, because uptime monitors
 * alert on status code, not body content. A health check that returns 200
 * with `{"status":"error"}` is a health check that never pages anyone.
 *
 * Deliberately says as little as possible: no version, no environment, no
 * error text. It is unauthenticated by necessity (a monitor cannot sign in),
 * so it must not become a reconnaissance endpoint. The operator gets the
 * detail from Vercel's logs; the public gets "up" or "down".
 */
export async function GET(): Promise<Response> {
  const started = Date.now();
  let dbOk = false;

  try {
    const supabase = getServiceClient();
    if (supabase) {
      // HEAD-style count: reads no rows and no user content, but proves the
      // connection, credentials and RLS path all work.
      const { error } = await supabase
        .from("handle_reservations")
        .select("handle_key", { head: true, count: "exact" });
      dbOk = !error;
      if (error) console.error("health: database check failed:", error.message);
    } else {
      console.error("health: Supabase service client unavailable");
    }
  } catch (err) {
    console.error("health: database check threw:", err);
  }

  return new Response(
    JSON.stringify({
      status: dbOk ? "ok" : "degraded",
      db: dbOk,
      ms: Date.now() - started,
    }),
    {
      status: dbOk ? 200 : 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-transform",
      },
    },
  );
}
