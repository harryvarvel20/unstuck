import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Stripe webhook. Signature-verified against the raw body. Handlers are
 * idempotent by construction: they set profiles.plan based on the *current*
 * subscription state, so replays and out-of-order deliveries converge.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return json({ error: "not_configured" }, 400);

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return json({ error: "not_configured" }, 500);
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("webhook signature verification failed:", err);
    return json({ error: "bad_signature" }, 400);
  }

  const service = getServiceClient();
  if (!service) {
    // Can't apply the change; 500 so Stripe retries once we're configured.
    return json({ error: "db_unavailable" }, 500);
  }

  async function setPlanByCustomer(customerId: string, plan: "free" | "pro") {
    const { error } = await service!
      .from("profiles")
      .update({ plan })
      .eq("stripe_customer_id", customerId);
    if (error) throw new Error(error.message);
  }

  async function setPlanByUser(
    userId: string,
    plan: "free" | "pro",
    customerId?: string,
  ) {
    const update: Record<string, unknown> = { plan };
    if (customerId) update.stripe_customer_id = customerId;
    const { error } = await service!
      .from("profiles")
      .update(update)
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const userId = session.client_reference_id;
        if (userId) {
          await setPlanByUser(userId, "pro", customerId ?? undefined);
        } else if (customerId) {
          await setPlanByCustomer(customerId, "pro");
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const active = ["active", "trialing", "past_due"].includes(sub.status);
        await setPlanByCustomer(customerId, active ? "pro" : "free");
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await setPlanByCustomer(customerId, "free");
        break;
      }
      default:
        // Unhandled event types are acknowledged and ignored.
        break;
    }
  } catch (err) {
    console.error(`webhook handler failed for ${event.type}:`, err);
    return json({ error: "handler_failed" }, 500); // Stripe will retry.
  }

  return json({ received: true }, 200);
}
