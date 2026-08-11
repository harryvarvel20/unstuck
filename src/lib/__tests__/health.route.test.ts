import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AA5 — /api/health exists to page a human during an outage, so the property
 * that matters is the **status code**, not the body. An uptime monitor alerts
 * on 5xx; one that returns 200 with `{"status":"error"}` never fires.
 *
 * Also pinned: the response must not leak diagnostic detail. It is
 * unauthenticated by necessity, so it must not become a recon endpoint.
 */

const h = vi.hoisted(() => ({
  select: vi.fn(async () => ({ error: null as { message: string } | null })),
  clientAvailable: true,
}));

vi.mock("@/lib/supabaseServer", () => ({
  getServiceClient: () =>
    h.clientAvailable ? { from: () => ({ select: h.select }) } : null,
  isSupabaseConfigured: () => true,
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  h.select.mockClear();
  h.clientAvailable = true;
  h.select.mockResolvedValue({ error: null });
});

describe("/api/health", () => {
  it("returns 200 when the database is reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe(true);
  });

  it("returns 503 — not 200 — when the database fails", async () => {
    h.select.mockResolvedValue({ error: { message: "connection refused" } });
    const res = await GET();
    // The whole point: a monitor must see a 5xx to raise an alert.
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.db).toBe(false);
  });

  it("returns 503 when Supabase is not configured at all", async () => {
    h.clientAvailable = false;
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("never leaks the underlying error to the caller", async () => {
    h.select.mockResolvedValue({
      error: { message: "FATAL: password authentication failed for user" },
    });
    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain("password");
    expect(text).not.toContain("FATAL");
  });

  it("is never cached — a stale 200 during an outage would hide it", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
