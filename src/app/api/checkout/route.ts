import { NextRequest } from "next/server";
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

const schema = z.object({ plan: z.enum(["monthly", "annual"]) });

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

  const base = appUrl(req.nextUrl.origin);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: TRIAL_DAYS },
      allow_promotion_codes: true,
      success_url: `${base}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
    });
    return json({ url: session.url }, 200);
  } catch (err) {
    console.error("checkout session create failed:", err);
    return json({ error: "billing_error" }, 500);
  }
}
