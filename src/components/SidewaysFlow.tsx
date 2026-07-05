"use client";

import { useState } from "react";
import type { BreakdownStep } from "@/lib/types";
import {
  parseItemsArray,
  parseStreamingMessage,
  type ParsedItem,
} from "@/lib/parseBreakdown";
import { streamPost, LimitReachedError } from "@/lib/streamClient";
import { FocusRoom } from "./FocusRoom";
import { capture, EVENTS } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

interface SidewaysItem {
  id: string;
  title: string;
  minutes: number;
  /** Present when the item is a whole saved task (so amnesty can archive it). */
  taskId?: string;
}

interface SidewaysFlowProps {
  signedIn: boolean;
  currentTaskId: string | null;
  /** Unchecked steps currently on screen. */
  localSteps: { index: number; step: BreakdownStep }[];
  onLimit: () => void;
}

type Stage = "closed" | "loading" | "triaged" | "applied" | "focus" | "empty";

interface Triage {
  message: string;
  must: ParsedItem[];
  later: ParsedItem[];
  amnesty: ParsedItem[];
}

function hoursLeftToday(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(22, 0, 0, 0); // assume the day winds down ~10pm
  const hrs = (end.getTime() - now.getTime()) / 3_600_000;
  return Math.max(1, Math.min(12, Math.round(hrs * 2) / 2));
}

export function SidewaysFlow({
  signedIn,
  currentTaskId,
  localSteps,
  onLimit,
}: SidewaysFlowProps) {
  const [stage, setStage] = useState<Stage>("closed");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [itemsById, setItemsById] = useState<Record<string, SidewaysItem>>({});
  const [error, setError] = useState(false);
  const [focusStep, setFocusStep] = useState<ParsedItem | null>(null);

  useEscape(
    () => {
      setStage("closed");
      setTriage(null);
    },
    stage !== "closed" && stage !== "focus",
  );

  async function open() {
    capture(EVENTS.sidewaysPressed);
    setStage("loading");
    setError(false);
    setTriage(null);

    // Gather remaining items: on-screen steps + (signed-in) other open tasks.
    const items: SidewaysItem[] = localSteps.map(({ index, step }) => ({
      id: `step-${index}`,
      title: step.title,
      minutes: step.minutes,
    }));

    if (signedIn) {
      try {
        const res = await fetch("/api/tasks");
        if (res.ok) {
          const body = (await res.json()) as {
            tasks: {
              id: string;
              input_text: string;
              steps: BreakdownStep[];
              completed_steps: boolean[];
              archived_at?: string | null;
            }[];
          };
          for (const t of body.tasks) {
            if (t.archived_at || t.id === currentTaskId) continue;
            const remaining = (t.steps ?? []).filter(
              (_, i) => !(t.completed_steps?.[i] ?? false),
            );
            if (remaining.length === 0) continue;
            items.push({
              id: `task-${t.id}`,
              taskId: t.id,
              title: t.input_text,
              minutes: Math.max(
                5,
                remaining.reduce((acc, s) => acc + (s.minutes || 5), 0),
              ),
            });
          }
        }
      } catch {
        /* current steps alone are fine */
      }
    }

    if (items.length === 0) {
      setStage("empty");
      return;
    }

    const map: Record<string, SidewaysItem> = {};
    for (const it of items) map[it.id] = it;
    setItemsById(map);

    try {
      await streamPost(
        "/api/sideways",
        {
          items: items.map(({ id, title, minutes }) => ({
            id,
            title,
            minutes,
          })),
          hoursLeft: hoursLeftToday(),
        },
        (buffer) => {
          const msg = parseStreamingMessage(buffer);
          setTriage({
            message: msg.message,
            must: parseItemsArray(buffer, "must").slice(0, 3),
            later: parseItemsArray(buffer, "later"),
            amnesty: parseItemsArray(buffer, "amnesty"),
          });
        },
      );
      setStage("triaged");
    } catch (err) {
      if (err instanceof LimitReachedError) {
        setStage("closed");
        onLimit();
        return;
      }
      setError(true);
      setStage("triaged");
    }
  }

  function applyAmnesty() {
    if (!triage) return;
    // Archive whole tasks granted amnesty — guilt-free, recoverable.
    for (const item of triage.amnesty) {
      const src = item.id ? itemsById[item.id] : undefined;
      if (src?.taskId) {
        void fetch(`/api/tasks/${src.taskId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }).catch(() => {});
      }
    }
    setStage("applied");
  }

  function close() {
    setStage("closed");
    setTriage(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        className="mx-auto mt-4 block text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
      >
        Day went sideways?
      </button>

      {stage !== "closed" && stage !== "focus" && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Rescue what matters"
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="inline-flex h-10 w-10 items-center justify-center self-start rounded-full text-muted transition-colors hover:text-text"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex-1 pb-10">
              <h2 className="text-xl font-semibold text-text">
                Plans collapse. Brains do that.
              </h2>
              <p className="mt-1 text-muted">
                Let&apos;s salvage what matters.
              </p>

              {stage === "empty" && (
                <p className="mt-8 text-muted">
                  There&apos;s nothing on the pile right now — which means the
                  day didn&apos;t go sideways, it just went. That&apos;s
                  allowed.
                </p>
              )}

              {stage === "loading" && !triage && (
                <p className="mt-8 animate-fade-in text-muted">
                  Sorting the pile…
                </p>
              )}

              {error && (
                <p className="mt-8 text-muted" role="alert">
                  Couldn&apos;t sort things just now — give it another go in a
                  moment.
                </p>
              )}

              {triage && !error && (
                <div className="mt-6 flex flex-col gap-5 animate-fade-in">
                  {triage.message && (
                    <p className="text-[0.95rem] text-accent">
                      “{triage.message}”
                    </p>
                  )}

                  {triage.must.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-text">
                        Must happen today
                      </h3>
                      <ul className="mt-2 flex flex-col gap-2">
                        {triage.must.map((item, i) => (
                          <li
                            key={i}
                            className="rounded-2xl border border-accent/40 bg-surface p-3.5"
                          >
                            <span className="text-text">{item.title}</span>
                            <span className="ml-2 text-sm text-muted">
                              ~{item.minutes} min
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {triage.later.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                        Can wait
                      </h3>
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
                        {triage.later.map((item, i) => (
                          <li key={i}>· {item.title}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {triage.amnesty.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                        Declare amnesty
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        Set down guilt-free. Recoverable any time — just not
                        today&apos;s problem.
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
                        {triage.amnesty.map((item, i) => (
                          <li
                            key={i}
                            className="line-through decoration-border"
                          >
                            {item.title}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {stage === "triaged" && (
                    <button
                      type="button"
                      onClick={applyAmnesty}
                      className="w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105"
                    >
                      Sounds right — set me up
                    </button>
                  )}

                  {stage === "applied" && (
                    <div className="animate-fade-in">
                      <p className="text-sm text-muted">
                        Done. The amnesty pile is parked, the rest can wait.
                        Just the top of the must list now:
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        {triage.must[0] && (
                          <button
                            type="button"
                            onClick={() => {
                              setFocusStep(triage.must[0] ?? null);
                              setStage("focus");
                            }}
                            className="w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105"
                          >
                            Start the first one with me
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={close}
                          className="w-full rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-muted transition-colors hover:text-text"
                        >
                          I&apos;ve got it from here
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {stage === "focus" && focusStep && (
        <FocusRoom
          step={{
            title: focusStep.title,
            minutes: Math.min(60, focusStep.minutes),
          }}
          stepIndex={0}
          taskId={null}
          otherSteps={[]}
          onDone={() => {}}
          onSwap={() => {}}
          onLimit={() => {
            close();
            onLimit();
          }}
          onClose={close}
        />
      )}
    </>
  );
}
