import { NextRequest } from "next/server";
import { getStripe, appUrl } from "@/lib/stripe";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** POST /api/billing-portal — open the Stripe customer portal (cancel = easy). */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return json({ error: "no_billing" }, 404);
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl(req.nextUrl.origin)}/account`,
    });
    return json({ url: session.url }, 200);
  } catch (err) {
    console.error("billing portal failed:", err);
    return json({ error: "billing_error" }, 500);
  }
}
