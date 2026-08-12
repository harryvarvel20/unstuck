import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { getStripe, appUrl, PRICES, TRIAL_DAYS } from "@/lib/stripe";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  plan: z.enum(["monthly", "annual"]),
  // Optional influencer/marketing discount code (a Stripe *promotion code*).
  code: z.string().trim().max(64).optional(),
});

/** POST /api/checkout — create a Stripe Checkout session for the signed-in user. */
export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return json({ error: "billing_unavailable" }, 503);
  }

  const priceId = PRICES[parsed.data.plan]();
  if (!priceId) return json({ error: "billing_unavailable" }, 503);

  // Get or create the Stripe customer for this user.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.plan === "pro") {
    return json({ error: "already_pro" }, 409);
  }

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const service = getServiceClient();
      const writer = service ?? supabase;
      await writer
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    } catch (err) {
      console.error("stripe customer create failed:", err);
      return json({ error: "billing_error" }, 500);
    }
  }

  // Discount code (a Stripe *promotion code* — one per influencer, created in
  // the Stripe dashboard). If the customer typed one, validate it server-side
  // and pre-apply it; otherwise leave Stripe's own promo-code field enabled so
  // they can still enter one on the hosted checkout page. Stripe forbids
  // passing `discounts` and `allow_promotion_codes` together, so it's one or
  // the other.
  let discounts: { promotion_code: string }[] | undefined;
  const code = parsed.data.code?.trim();
  if (code) {
    try {
      const promos = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });
      const promo = promos.data[0];
      if (!promo) return json({ error: "invalid_code" }, 400);
      discounts = [{ promotion_code: promo.id }];
    } catch (err) {
      console.error("promo code lookup failed:", err);
      return json({ error: "invalid_code" }, 400);
    }
  }

  const base = appUrl(req.nextUrl.origin);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS },
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    success_url: `${base}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
  };
  // Stripe "Managed Payments" (merchant-of-record + automatic tax) is on by
  // default for new accounts. It adds VAT on top of our price plus a 3.5%
  // per-transaction fee, and rejects checkout unless every product carries a
  // tax code. The dashboard will show a VAT line on the price because of it.
  //
  // We advertise a flat, all-in £9.99/£99 and are NOT VAT registered, so
  // charging VAT would both contradict Terms §10 and collect tax we have no
  // entitlement to. Disabled per session so we charge exactly the advertised
  // amount. The param is newer than the pinned SDK types, hence the cast.
  (params as { managed_payments?: { enabled: boolean } }).managed_payments = {
    enabled: false,
  };

  try {
    const session = await stripe.checkout.sessions.create(params);
    return json({ url: session.url }, 200);
  } catch (err) {
    console.error("checkout session create failed:", err);
    return json({ error: "billing_error" }, 500);
  }
}
