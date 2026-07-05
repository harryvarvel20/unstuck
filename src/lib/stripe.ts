import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily create the Stripe client so a missing key fails at request time. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!client) client = new Stripe(key);
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Resolve the app's public base URL for redirect targets. */
export function appUrl(fallbackOrigin: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin;
}

export const PRICES = {
  monthly: () => process.env.STRIPE_PRICE_MONTHLY,
  annual: () => process.env.STRIPE_PRICE_ANNUAL,
} as const;

export const TRIAL_DAYS = 7;
