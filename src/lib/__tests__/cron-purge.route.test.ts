import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * AA4 — /api/cron/purge deletes data, so its authorisation is the whole
 * security story. These tests pin three things:
 *
 *  1. It refuses every unauthenticated shape of request.
 *  2. It **fails closed** when CRON_SECRET is unset — an endpoint that
 *     deleted rows for anyone if a variable went missing would be far worse
 *     than the retention gap it exists to fix.
 *  3. When properly authorised it calls `purge_expired_data` exactly once.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({
    data: {
      anon_usage: 12,
      usage_log: 3,
      feature_usage: 7,
      reports_reviewed: 0,
      handle_reservations: 1,
      reports_open_over_12m: 0,
    },
    error: null as { message: string } | null,
  })),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getServiceClient: () => ({ rpc: h.rpc }),
  isSupabaseConfigured: () => true,
}));

import { GET } from "@/app/api/cron/purge/route";

const SECRET = "test-cron-secret-value";

function req(authHeader?: string): NextRequest {
  return new NextRequest("http://test.local/api/cron/purge", {
    method: "GET",
    ...(authHeader ? { headers: { authorization: authHeader } } : {}),
  });
}

beforeEach(() => {
  h.rpc.mockClear();
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("/api/cron/purge — authorisation", () => {
  it("401s with no Authorization header, and never touches the database", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("401s on a wrong secret", async () => {
    const res = await GET(req("Bearer not-the-secret"));
    expect(res.status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("401s when the secret is sent without the Bearer prefix", async () => {
    const res = await GET(req(SECRET));
    expect(res.status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("FAILS CLOSED when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    // An attacker sending no header must not be let through just because the
    // server-side secret is also absent — `undefined === undefined` would
    // otherwise authorise everyone.
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();

    const res2 = await GET(req("Bearer undefined"));
    expect(res2.status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("/api/cron/purge — behaviour when authorised", () => {
  it("calls purge_expired_data and returns the row counts", async () => {
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("purge_expired_data");

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.purged.anon_usage).toBe(12);
  });

  it("also reports AI usage volume (AA8)", async () => {
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("ai_usage_report", { p_days: 1 });
  });

  it("surfaces a database failure as a 500 rather than a false success", async () => {
    h.rpc.mockResolvedValueOnce({
      data: null as never,
      error: { message: "permission denied" },
    });
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("purge_failed");
  });

  it("still returns 200 if only the usage report fails", async () => {
    // The retention purge is the job that must not be missed. A reporting
    // failure is informational and must not mark the whole run as failed —
    // otherwise a cosmetic bug would look like a compliance failure.
    h.rpc
      .mockResolvedValueOnce({ data: { anon_usage: 1 } as never, error: null })
      .mockResolvedValueOnce({
        data: null as never,
        error: { message: "function does not exist" },
      });
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.usage).toBeNull();
  });

  it("is safe to run twice — no state carried between invocations", async () => {
    h.rpc.mockClear();
    await GET(req(`Bearer ${SECRET}`));
    await GET(req(`Bearer ${SECRET}`));
    // Vercel cron delivery is best-effort and can double-fire; the route must
    // simply call the (idempotent) functions again. Two RPCs per run.
    expect(h.rpc).toHaveBeenCalledTimes(4);
  });
});
