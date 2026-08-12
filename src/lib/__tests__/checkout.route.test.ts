import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { FakeQuery } from "./helpers/fakeDb";

/**
 * Z1 route tests — /api/checkout with a MOCKED Stripe + Supabase.
 * Proves: promo codes are validated server-side (invalid → 400, session never
 * created); a pre-applied discount and Stripe's own promo field are mutually
 * exclusive; Managed Payments is disabled on every session (customers pay the
 * advertised price); Pro users can't double-subscribe; input is validated.
 */

interface SessionParams {
  allow_promotion_codes?: boolean;
  discounts?: { promotion_code: string }[];
  managed_payments?: { enabled: boolean };
  subscription_data?: { trial_period_days: number };
  mode?: string;
  line_items?: { price: string; quantity: number }[];
  success_url?: string;
  cancel_url?: string;
}

const h = vi.hoisted(() => {
  const state = {
    profile: {
      stripe_customer_id: "cus_test1",
      plan: "free",
    } as Record<string, unknown> | null,
    promoList: { data: [] as { id: string }[] },
  };
  return {
    state,
    sessionsCreate: vi.fn<(p: unknown) => Promise<{ url: string }>>(
      async () => ({
        url: "https://checkout.stripe.test/session",
      }),
    ),
    promoCodesList: vi.fn(async () => state.promoList),
    customersCreate: vi.fn(async () => ({ id: "cus_new" })),
  };
});

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    getStripe: () => ({
      checkout: { sessions: { create: h.sessionsCreate } },
      promotionCodes: { list: h.promoCodesList },
      customers: { create: h.customersCreate },
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "t@example.test" } },
      }),
    },
    from: () => new FakeQuery({ data: h.state.profile }),
  }),
}));

vi.mock("@/lib/supabaseServer", () => ({ getServiceClient: () => null }));

import { POST } from "@/app/api/checkout/route";
// The mock above spreads the real module, so this is the genuine value.
import { TRIAL_DAYS } from "@/lib/stripe";

function req(body: unknown): NextRequest {
  return new NextRequest("http://test.local/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function lastSessionParams(): SessionParams {
  const call = h.sessionsCreate.mock.calls.at(-1);
  return (call?.[0] ?? {}) as SessionParams;
}

beforeEach(() => {
  process.env.STRIPE_PRICE_MONTHLY = "price_m_test";
  process.env.STRIPE_PRICE_ANNUAL = "price_a_test";
  h.state.profile = { stripe_customer_id: "cus_test1", plan: "free" };
  h.state.promoList = { data: [] };
  h.sessionsCreate.mockClear();
  h.promoCodesList.mockClear();
});

describe("/api/checkout — session creation", () => {
  it("no code → Stripe's own promo field stays available", async () => {
    const res = await POST(req({ plan: "monthly" }));
    expect(res.status).toBe(200);
    const p = lastSessionParams();
    expect(p.allow_promotion_codes).toBe(true);
    expect(p.discounts).toBeUndefined();
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_m_test", quantity: 1 }]);
    expect(p.subscription_data?.trial_period_days).toBe(TRIAL_DAYS);
    expect(TRIAL_DAYS).toBe(4);
  });

  it("Managed Payments is disabled on EVERY session (advertised price only)", async () => {
    await POST(req({ plan: "monthly" }));
    expect(lastSessionParams().managed_payments).toEqual({ enabled: false });
    await POST(req({ plan: "annual", code: "LAUNCH10" })).catch(() => {});
  });

  it("valid code → discount pre-applied, promo field OMITTED (Stripe rejects both)", async () => {
    h.state.promoList = { data: [{ id: "promo_9" }] };
    const res = await POST(req({ plan: "annual", code: "LAUNCH10" }));
    expect(res.status).toBe(200);
    const p = lastSessionParams();
    expect(p.discounts).toEqual([{ promotion_code: "promo_9" }]);
    expect(p.allow_promotion_codes).toBeUndefined();
    expect(h.promoCodesList).toHaveBeenCalledWith({
      code: "LAUNCH10",
      active: true,
      limit: 1,
    });
  });

  it("invalid code → 400 invalid_code and NO session is created", async () => {
    h.state.promoList = { data: [] };
    const res = await POST(req({ plan: "monthly", code: "NOPE" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_code");
    expect(h.sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("/api/checkout — guards", () => {
  it("already-Pro → 409 (no double subscription)", async () => {
    h.state.profile = { stripe_customer_id: "cus_test1", plan: "pro" };
    const res = await POST(req({ plan: "monthly" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_pro");
    expect(h.sessionsCreate).not.toHaveBeenCalled();
  });

  it("invalid plan → 400", async () => {
    expect((await POST(req({ plan: "lifetime" }))).status).toBe(400);
  });

  it("missing price env → 503 billing_unavailable", async () => {
    delete process.env.STRIPE_PRICE_MONTHLY;
    const res = await POST(req({ plan: "monthly" }));
    expect(res.status).toBe(503);
  });
});
