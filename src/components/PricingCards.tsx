"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { capture, EVENTS } from "@/lib/analytics";

interface PricingCardsProps {
  signedIn: boolean;
  isPro: boolean;
}

const FREE_FEATURES = [
  "3 breakdowns a day",
  "1 focus session a day",
  "Photo-to-plan & Pick-for-me",
  "SOS + cool-down — always free",
  "Saved tasks & history",
];

const PRO_FEATURES = [
  "Unlimited breakdowns & focus sessions — your body double, any time",
  "Time Truth + the timed day plan that reflows when life happens",
  "Morning plan, evening wind-down & resilient routines",
  "Regulate suite: decompress + the message-spiral defuser",
  "Dopamenu, Idea Vault & Impulse patterns",
  "Focus Profile + a weekly wins recap you can share",
  "Activity Center: friends who get it, wins, playbooks, boosts & buddies",
  "Parents Mode: support your child with ADHD — game plans, kid tools & calm",
];

export function PricingCards({ signedIn, isPro }: PricingCardsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");

  async function subscribe(plan: "monthly" | "annual") {
    if (!signedIn) {
      router.push("/login?next=/pricing");
      return;
    }
    setLoading(plan);
    setError(null);
    const trimmed = code.trim();
    capture(EVENTS.checkoutStarted, { plan, code: trimmed ? true : false });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trimmed ? { plan, code: trimmed } : { plan }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      if (body.error === "already_pro") {
        router.push("/account");
        return;
      }
      if (body.error === "invalid_code") {
        setError(
          "That discount code isn't valid — check it and try again, or leave it blank.",
        );
        return;
      }
      setError("Checkout isn't available right now — try again in a moment.");
    } catch {
      setError("Checkout isn't available right now — try again in a moment.");
    } finally {
      setLoading(null);
    }
  }

  if (isPro) {
    return (
      <div className="rounded-3xl border border-accent/40 bg-accent-soft/60 p-6 text-center">
        <p className="text-lg font-semibold text-text">You&apos;re on Pro 💛</p>
        <p className="mt-2 text-muted">
          Everything&apos;s unlocked. Manage or cancel any time from your
          account — one tap, no hoops.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-3xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-text">Free</h2>
          <p className="mt-1 text-3xl font-bold text-text">
            £0
            <span className="text-base font-normal text-muted"> forever</span>
          </p>
          <ul className="mt-4 flex flex-col gap-2.5 text-[0.95rem] text-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check muted />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-5 text-sm text-muted">
            You&apos;re already on this — no card, no catch.
          </p>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-3xl border-2 border-accent bg-surface p-6">
          <span className="absolute -top-3 right-5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">
            7-day free trial
          </span>
          <h2 className="text-lg font-semibold text-text">Pro</h2>
          <p className="mt-1 text-3xl font-bold text-text">
            £7.99
            <span className="text-base font-normal text-muted">/month</span>
          </p>
          <ul className="mt-4 flex flex-col gap-2.5 text-[0.95rem] text-text">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => subscribe("annual")}
              disabled={loading !== null}
              className="w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            >
              {loading === "annual"
                ? "Opening checkout…"
                : "£59/year — over 4 months free"}
            </button>
            <button
              type="button"
              onClick={() => subscribe("monthly")}
              disabled={loading !== null}
              className="w-full rounded-2xl border border-border bg-surface-2 px-5 py-3 font-medium text-text transition-colors hover:border-accent/50 disabled:opacity-60"
            >
              {loading === "monthly" ? "Opening checkout…" : "£7.99/month"}
            </button>
          </div>

          {showCode ? (
            <div className="mt-4">
              <label
                htmlFor="discount-code"
                className="text-xs font-medium text-muted"
              >
                Discount code
              </label>
              <input
                id="discount-code"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter your creator's code"
                maxLength={64}
                disabled={loading !== null}
                className="mt-1 w-full rounded-2xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-text placeholder:text-muted/70 focus:border-accent/60 focus:outline-none disabled:opacity-60"
              />
              <p className="mt-1.5 text-xs text-muted/80">
                Got a code from a creator or partner? Pop it in for your
                discount — it&apos;s applied at checkout.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCode(true)}
              className="mt-3 self-start text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
            >
              Have a discount code?
            </button>
          )}

          <p className="mt-3 text-center text-xs text-muted">
            Free for 7 days, cancel in one tap. We&apos;d rather you leave happy
            than stay trapped.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Check({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`mt-0.5 flex-shrink-0 ${muted ? "text-muted" : "text-accent"}`}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
