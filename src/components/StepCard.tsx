"use client";

import type { BreakdownStep } from "@/lib/types";
import { burstFromElement } from "@/lib/confetti";
import { haptic } from "@/lib/design";

export interface SubState {
  loading: boolean;
  steps: BreakdownStep[];
  error: boolean;
}

interface StepCardProps {
  step: BreakdownStep;
  index: number;
  checked: boolean;
  onToggle: (index: number) => void;
  onBreakDownMore: (index: number) => void;
  onTooBig: () => void;
  onFocus: (index: number) => void;
  busy: boolean;
  sub?: SubState;
}

export function StepCard({
  step,
  index,
  checked,
  onToggle,
  onBreakDownMore,
  onTooBig,
  onFocus,
  busy,
  sub,
}: StepCardProps) {
  return (
    <li className="animate-card-in">
      <div
        className={`rounded-2xl border p-4 transition-colors sm:p-5 ${
          checked
            ? "border-accent/40 bg-accent-soft/60"
            : "border-border bg-surface"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Mark step ${index + 1} done: ${step.title}`}
            onClick={(e) => {
              if (!checked) {
                burstFromElement(e.currentTarget);
                haptic();
              }
              onToggle(index);
            }}
            className={`mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              checked
                ? "border-accent bg-accent text-accent-ink"
                : "border-border bg-transparent text-transparent hover:border-accent/60"
            }`}
          >
            {checked && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="animate-tick-pop"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p
                className={`text-[1.05rem] font-medium leading-snug ${
                  checked ? "text-muted line-through" : "text-text"
                }`}
              >
                {step.title}
              </p>
              <span className="mt-0.5 flex-shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
                {step.minutes} min
              </span>
            </div>

            {step.tip && (
              <p className="mt-1.5 text-sm text-muted">{step.tip}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!checked && (
                <button
                  type="button"
                  onClick={() => onFocus(index)}
                  disabled={busy}
                  className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-ink transition-all hover:brightness-105 disabled:opacity-50"
                >
                  Do this with me
                </button>
              )}
              <button
                type="button"
                onClick={() => onBreakDownMore(index)}
                disabled={busy || sub?.loading}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
              >
                Break this down more
              </button>
              <button
                type="button"
                onClick={onTooBig}
                disabled={busy}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
              >
                Too big
              </button>
            </div>

            {/* Nested sub-breakdown */}
            {sub && (sub.loading || sub.steps.length > 0 || sub.error) && (
              <div className="mt-4 border-l-2 border-accent/30 pl-4">
                {sub.loading && sub.steps.length === 0 && (
                  <p className="text-sm text-muted">
                    Breaking that into smaller pieces…
                  </p>
                )}
                {sub.error && (
                  <p className="text-sm text-muted">
                    Couldn&apos;t break that down just now — try again in a
                    moment.
                  </p>
                )}
                {sub.steps.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {sub.steps.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-text"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span>
                          {s.title}
                          <span className="ml-1.5 text-muted">
                            · {s.minutes} min
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
