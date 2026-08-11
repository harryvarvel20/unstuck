import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * GET /api/cron/purge — daily retention sweep (AA4).
 *
 * Enforces the retention schedule published in the Privacy Policy and
 * legal/RETENTION-AND-BREACH.md: rate-limit counters (including salted IP
 * hashes) after 30 days, resolved moderation reports after 12 months, and
 * expired username reservations. Before this existed, none of it was
 * enforced — the notice described behaviour the system did not perform.
 *
 * Invoked by Vercel Cron at 03:00 UTC daily (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without a matching secret this
 * returns 401, so the endpoint is inert if CRON_SECRET is ever unset —
 * failing closed rather than exposing a public delete trigger.
 *
 * Cron delivery is best-effort and may miss or duplicate a run, so the work
 * is idempotent: every statement is a date-bounded DELETE, and a repeat run
 * simply finds nothing left to remove.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    console.error("retention purge: Supabase service client unavailable");
    return json({ error: "unavailable" }, 503);
  }

  const { data, error } = await supabase.rpc("purge_expired_data");
  if (error) {
    console.error("retention purge failed:", error.message);
    return json({ error: "purge_failed" }, 500);
  }

  // Logged so the run is auditable from Vercel's runtime logs — evidence
  // that the retention promise is actually being kept.
  console.log("retention purge:", JSON.stringify(data));
  return json({ ok: true, purged: data }, 200);
}
