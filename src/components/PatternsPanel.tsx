"use client";

import { useEffect, useState } from "react";
import type { Pattern } from "@/lib/patterns";

/**
 * "What ADHV has noticed" — observations drawn from what the user actually
 * did, with no model involved.
 *
 * Sits above the AI-written summary deliberately. One of these is a machine's
 * opinion about you; the other is a count of things you finished. When they
 * disagree, the count is right — and the reader should meet it first.
 *
 * Loads on the client so the page renders instantly and this fills in, rather
 * than holding the whole route on two extra queries.
 */
export function PatternsPanel() {
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [samples, setSamples] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Timestamps are UTC; without the offset every time-of-day
        // observation is wrong outside one timezone.
        const tz = new Date().getTimezoneOffset();
        const res = await fetch(`/api/patterns?tz=${tz}`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          patterns?: Pattern[];
          samples?: number;
        };
        if (cancelled) return;
        setPatterns(body.patterns ?? []);
        setSamples(body.samples ?? 0);
      } catch {
        /* Silent: this is a bonus panel, never the reason a page fails. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing yet, or nothing worth saying — render nothing at all rather than
  // an empty box implying the user hasn't done enough.
  if (patterns === null) return null;

  if (patterns.length === 0) {
    // Only encourage once there is *some* history; a brand-new user doesn't
    // need a progress bar toward being observed.
    if (samples === 0) return null;
    return (
      <section className="glass rounded-3xl p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-text">
          Still watching
        </h2>
        <p className="mt-2 text-sm text-muted">
          A few more finished steps and patterns start showing up here — when
          you get going, which days are heavier, how long things really take
          you. Nothing to do; it builds itself.
        </p>
      </section>
    );
  }

  return (
    // The one card on this page that earns `card-featured` — everything else
    // here is an AI-written summary; this is the measured thing.
    <section className="card-featured engine-turned rounded-3xl p-6 sm:p-7">
      <p className="eyebrow">Observed</p>
      <h2 className="deboss mt-1.5 font-display text-xl font-semibold text-text">
        What ADHV has noticed
      </h2>
      <p className="mt-1 text-sm text-muted">
        Drawn from what you actually did — not a guess.
      </p>

      <div className="rule-ornament my-5" aria-hidden="true">
        <span />
      </div>

      <ul className="flex flex-col gap-5">
        {patterns.map((p, i) => (
          <li key={p.id} className="flex items-start gap-3.5">
            {/* Numbered rather than bulleted: these are findings, and a
                printed page numbers its findings. */}
            <span className="numeral mt-0.5" aria-hidden="true">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[1.0625rem] font-semibold leading-snug text-text">
                {p.headline}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {p.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
