"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_META,
  computeInsight,
  type Impulse,
  type ImpulseCategory,
} from "@/lib/impulses";
import { capture } from "@/lib/analytics";

const APPETISERS = [
  "put a song on and listen to the whole thing",
  "step outside for three minutes",
  "10 star jumps — the spark often just wants movement",
  "make a proper drink, slowly",
];

function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function fmtLeft(ms: number): string {
  if (ms <= 0) return "ready";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ImpulseScreen() {
  const [impulses, setImpulses] = useState<Impulse[]>([]);
  const [loading, setLoading] = useState(true);
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState<ImpulseCategory>("buy");
  const [amount, setAmount] = useState("");
  const [justLogged, setJustLogged] = useState<Impulse | null>(null);
  const now = useNow();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/impulses");
        if (res.ok) {
          const body = (await res.json()) as { impulses: Impulse[] };
          setImpulses(body.impulses);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const waiting = impulses.filter((i) => i.outcome === null);
  const insight = useMemo(() => computeInsight(impulses), [impulses]);
  const appetiser = useMemo(
    () => APPETISERS[Math.floor(Math.random() * APPETISERS.length)],
    // justLogged is a deliberate re-roll trigger: pick a fresh appetiser each
    // time the user logs an impulse (the memo body intentionally ignores it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [justLogged],
  );

  async function log(e?: React.FormEvent) {
    e?.preventDefault();
    if (!what.trim()) return;
    const amt = category === "buy" && amount ? Number(amount) : null;
    try {
      const res = await fetch("/api/impulses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          what: what.trim(),
          category,
          amount: Number.isFinite(amt as number) ? amt : null,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { impulse: Impulse };
        setImpulses((prev) => [body.impulse, ...prev]);
        setJustLogged(body.impulse);
        setWhat("");
        setAmount("");
        capture("impulse_paused", { category });
      }
    } catch {
      /* noop */
    }
  }

  async function resolve(im: Impulse, outcome: "acted" | "passed") {
    setImpulses((prev) =>
      prev.map((i) => (i.id === im.id ? { ...i, outcome } : i)),
    );
    await fetch(`/api/impulses/${im.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome }),
    }).catch(() => {});
  }

  if (justLogged) {
    const leftMs = new Date(justLogged.wait_until).getTime() - now;
    return (
      <div className="animate-fade-in rounded-3xl border border-accent/40 bg-accent-soft/40 p-6 text-center">
        <div className="text-3xl">⏳</div>
        <h2 className="mt-3 font-display text-xl font-semibold text-text">
          Paused for {fmtLeft(leftMs)}.
        </h2>
        <p className="mt-2 text-muted">
          The impulse is often understimulation looking for a hit. Feed it
          differently: <span className="text-text">{appetiser}</span>.
        </p>
        <p className="mt-3 text-sm text-muted">
          When the timer&apos;s up we&apos;ll ask if you still want it. No
          lecture either way.
        </p>
        <button
          type="button"
          onClick={() => setJustLogged(null)}
          className="grad-primary mt-6 rounded-2xl px-6 py-3 font-semibold shadow-soft"
        >
          Okay
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* log form */}
      <form
        onSubmit={log}
        className="rounded-3xl border border-border bg-surface p-5"
      >
        <p className="font-medium text-text">
          About to do something impulsive?
        </p>
        <input
          value={what}
          onChange={(e) => setWhat(e.target.value.slice(0, 300))}
          placeholder="what is it? e.g. buy the £90 headphones"
          className="mt-3 w-full rounded-2xl border border-border bg-bg px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_META) as ImpulseCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                category === c
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted hover:border-accent/40"
              }`}
            >
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
        {category === "buy" && (
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="£ amount (optional)"
            className="mt-3 w-full rounded-2xl border border-border bg-bg px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        )}
        <button
          type="submit"
          disabled={!what.trim()}
          className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
        >
          Pause it
        </button>
      </form>

      {/* waiting list */}
      {waiting.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            On pause
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {waiting.map((im) => {
              const leftMs = new Date(im.wait_until).getTime() - now;
              const ready = leftMs <= 0;
              return (
                <li key={im.id} className="glass rounded-2xl p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text">
                      {CATEGORY_META[im.category].emoji} {im.what}
                      {im.amount ? (
                        <span className="ml-1.5 text-muted">£{im.amount}</span>
                      ) : null}
                    </span>
                    {!ready && (
                      <span className="flex-shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-accent">
                        {fmtLeft(leftMs)}
                      </span>
                    )}
                  </div>
                  {ready && (
                    <div className="mt-3">
                      <p className="text-sm text-text">
                        Still want it? Then it might be a real want, not a
                        spark. Your call.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void resolve(im, "acted")}
                          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text"
                        >
                          Still want it
                        </button>
                        <button
                          type="button"
                          onClick={() => void resolve(im, "passed")}
                          className="grad-primary rounded-xl px-4 py-2 text-sm font-semibold"
                        >
                          Spark passed
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* insight card */}
      {!loading && insight.total >= 5 && (
        <div className="mt-6 rounded-3xl border border-accent/30 bg-gradient-to-br from-[rgb(var(--surface))] to-[rgb(var(--surface-2))] p-5 shadow-float">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Your impulse patterns
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat value={`£${insight.poundsPaused}`} label="paused" />
            <Stat
              value={`£${insight.poundsSpent}`}
              label="spent after waiting"
            />
          </div>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-text">
            {insight.nightPct >= 55 ? (
              <>
                Your impulses are{" "}
                <strong>{insight.nightPct}% night-time</strong>. Future-you
                keeps getting outvoted after dark — worth knowing, not worth
                beating yourself up over.
              </>
            ) : insight.peakHourLabel ? (
              <>
                They cluster around <strong>{insight.peakHourLabel}</strong>.
                {insight.topCategory
                  ? ` Mostly "${CATEGORY_META[insight.topCategory].label.toLowerCase()}" urges.`
                  : ""}{" "}
                That&apos;s data, not a verdict.
              </>
            ) : (
              <>
                {insight.passed} of {insight.total} sparks passed on their own.
                That&apos;s the pause doing its quiet work.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-2xl font-bold text-accent">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
