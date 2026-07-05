/**
 * Analytics stub. PostHog itself is initialised in a later phase; until then
 * every capture is a safe no-op. Event names are the product's single source
 * of truth, so wiring stays stable when PostHog lands.
 */

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    posthog?: { capture: (event: string, props?: Props) => void };
  }
}

export function capture(event: string, props?: Props): void {
  if (typeof window === "undefined") return;
  try {
    window.posthog?.capture(event, props);
  } catch {
    /* analytics must never break the product */
  }
}

/** Canonical event names. */
export const EVENTS = {
  breakdownCreated: "breakdown_created",
  stepCompleted: "step_completed",
  limitHit: "limit_hit",
  checkoutStarted: "checkout_started",
  subscribed: "subscribed",
  focusStarted: "focus_session_started",
  focusCompleted: "focus_session_completed",
  struggledPressed: "struggled_pressed",
  pickForMeUsed: "pick_for_me_used",
  sidewaysPressed: "sideways_pressed",
  morningPlanCreated: "morning_plan_created",
  recapShared: "recap_shared",
} as const;
