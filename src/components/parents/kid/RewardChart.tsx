"use client";

import { useEffect, useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { haptic } from "@/lib/design";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";
import { bandConfig, type Child } from "@/lib/parents";
import { loadReward, saveReward, earnToken } from "@/lib/parentsLocal";

/**
 * Reward chart / token economy (W4). Parent sets up to 3 target behaviours +
 * a rewards menu; the child taps to EARN a token with a satisfying burst.
 * Earning only — loss is never shown. Currency adapts by age (stickers /
 * points / privileges). For teens it's framed as self-tracking they own.
 */
export function RewardChart({
  child,
  onClose,
}: {
  child: Child;
  onClose: () => void;
}) {
  const cfg = bandConfig(child.ageBand);
  const [behaviours, setBehaviours] = useState<string[]>([]);
  const [rewards, setRewards] = useState<string[]>([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  useEscape(onClose);

  useEffect(() => {
    // Device-only: the reward chart never leaves this browser.
    const r = loadReward(child.id);
    setBehaviours(r.behaviours);
    setRewards(r.rewards);
    setTokens(r.tokens);
    if (r.behaviours.length === 0) setEditing(true);
    setLoading(false);
  }, [child.id]);

  function earn(e: React.MouseEvent) {
    haptic(12);
    const r = (e.target as HTMLElement).getBoundingClientRect();
    burstConfetti(r.left + r.width / 2, r.top + r.height / 2, 16);
    setTokens(earnToken(child.id));
    capture("reward_earned", { ageBand: child.ageBand });
  }

  const currencyEmoji =
    cfg.rewardCurrency === "stickers"
      ? "⭐"
      : cfg.rewardCurrency === "points"
        ? "🔹"
        : "🎟️";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Reward chart"
    >
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
        >
          ✕ close
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-sm font-medium text-accent"
        >
          {editing ? "Done editing" : "Edit"}
        </button>
      </div>

      {loading ? (
        <p className="mt-16 text-center text-muted">One moment…</p>
      ) : editing ? (
        <RewardSetup
          childId={child.id}
          initialBehaviours={behaviours}
          initialRewards={rewards}
          currencyLabel={cfg.rewardCurrency}
          onSaved={(b, r) => {
            setBehaviours(b);
            setRewards(r);
            setEditing(false);
          }}
        />
      ) : (
        <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted">
            {cfg.rewardCurrency} earned
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-3xl">
            {tokens === 0 ? (
              <span className="text-base text-muted">
                Tap a goal below to earn your first one!
              </span>
            ) : (
              Array.from({ length: Math.min(tokens, 40) }).map((_, i) => (
                <span key={i}>{currencyEmoji}</span>
              ))
            )}
          </div>
          {tokens > 40 && (
            <p className="mt-1 text-sm text-muted">…and {tokens - 40} more!</p>
          )}

          <h2 className="mt-8 font-display text-xl font-semibold text-text">
            {child.ageBand === "13-17" ? "Track when you" : "Earn one when you"}
          </h2>
          <div className="mt-3 flex flex-col gap-2.5">
            {behaviours.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={earn}
                className="grad-primary rounded-2xl px-5 py-4 text-lg font-semibold shadow-soft transition-transform active:scale-[0.98]"
              >
                {b} +1 {currencyEmoji}
              </button>
            ))}
          </div>

          {rewards.length > 0 && (
            <div className="mt-8 rounded-3xl border border-border bg-surface p-5 text-left">
              <p className="text-sm font-semibold text-text">
                {child.ageBand === "13-17"
                  ? "Agreed rewards"
                  : "Working towards"}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-muted">
                {rewards.map((r, i) => (
                  <li key={i}>🎁 {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RewardSetup({
  childId,
  initialBehaviours,
  initialRewards,
  currencyLabel,
  onSaved,
}: {
  childId: string;
  initialBehaviours: string[];
  initialRewards: string[];
  currencyLabel: string;
  onSaved: (b: string[], r: string[]) => void;
}) {
  const [b, setB] = useState<string>(initialBehaviours.join("\n"));
  const [r, setR] = useState<string>(initialRewards.join("\n"));
  const [busy, setBusy] = useState(false);

  function save() {
    setBusy(true);
    const behaviours = b
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 3);
    const rewards = r
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
    saveReward(childId, { behaviours, rewards });
    setBusy(false);
    onSaved(behaviours, rewards);
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
      <h1 className="font-display text-2xl font-semibold text-text">
        Set up the chart
      </h1>
      <p className="mt-2 text-sm text-muted">
        Pick 2–3 things to notice (choose them <em>with</em> your child), and a
        small menu of rewards. Tokens are only ever earned — never taken away.
      </p>
      <label className="mt-5 block text-sm font-medium text-muted">
        Up to 3 goals (one per line)
      </label>
      <textarea
        value={b}
        onChange={(e) => setB(e.target.value.slice(0, 300))}
        rows={3}
        placeholder={
          "Got dressed the first time asked\nKind words to your sister\nStarted homework"
        }
        className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/50 focus:border-accent focus:outline-none"
      />
      <label className="mt-4 block text-sm font-medium text-muted">
        Rewards menu ({currencyLabel} go towards these)
      </label>
      <textarea
        value={r}
        onChange={(e) => setR(e.target.value.slice(0, 400))}
        rows={3}
        placeholder={
          "Extra story at bedtime\nPick the film on Friday\nTrip to the park"
        }
        className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/50 focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || !b.trim()}
        className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save chart"}
      </button>
    </div>
  );
}
