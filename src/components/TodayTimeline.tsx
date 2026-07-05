"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  buildTimeline,
  minutesToHhmm,
  type TimelineItem,
  type TimelineEntry,
} from "@/lib/timeline";
import { burstFromElement } from "@/lib/confetti";
import { haptic } from "@/lib/design";
import { capture } from "@/lib/analytics";

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Escalating-but-kind heads-ups for hard-time items. */
const HEADS_UPS: { at: number; text: (t: string, when: string) => string }[] = [
  {
    at: 30,
    text: (t, when) =>
      `No action needed. Just so your brain knows: "${t}" starts by ${when}.`,
  },
  { at: 10, text: (t) => `Start wrapping the current step — "${t}" is soon.` },
  { at: 0, text: () => `Now is the moment — shoes on.` },
];

export function TodayTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [ratio, setRatio] = useState(1);
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(nowMinutes());
  const [toast, setToast] = useState<string | null>(null);
  const [overflowDismissed, setOverflowDismissed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  // --- load -----------------------------------------------------------------
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/today");
        if (!res.ok) throw new Error("load failed");
        const body = (await res.json()) as {
          items: TimelineItem[];
          ratio: number;
          planId: string | null;
        };
        setItems(body.items);
        setRatio(body.ratio);
        setPlanId(body.planId);
      } catch {
        /* items stay empty */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- schedule ---------------------------------------------------------------
  // Rebuilding from "now" every few minutes IS the quiet auto-repair: overruns
  // simply reflow forward; nothing is ever marked late.
  const nowBucket = Math.floor(now / 5);
  const { entries, overflow } = useMemo(() => {
    void nowBucket;
    return buildTimeline(items, {
      startAt: Math.max(nowMinutes(), 6 * 60),
      ratio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ratio, nowBucket]);

  const doneItems = useMemo(() => items.filter((i) => i.done), [items]);

  // --- clock + heads-ups --------------------------------------------------------
  useEffect(() => {
    const tick = () => {
      const n = nowMinutes();
      setNow(n);
      for (const e of entries) {
        if (e.kind !== "task" || e.startBy === undefined || e.item?.done) {
          continue;
        }
        for (const h of HEADS_UPS) {
          const key = `${e.item?.id ?? e.title}-${h.at}`;
          const delta = e.startBy - n;
          if (delta <= h.at && delta > h.at - 2 && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            setToast(h.text(e.title, minutesToHhmm(e.startBy)));
            window.setTimeout(() => setToast(null), 9000);
          }
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [entries]);

  // --- persistence -----------------------------------------------------------
  const save = useCallback(
    (next: TimelineItem[]) => {
      void fetch("/api/today", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: next, planId }),
      })
        .then(async (r) => {
          if (r.ok) {
            const b = (await r.json()) as { planId: string };
            setPlanId(b.planId);
          }
        })
        .catch(() => {});
    },
    [planId],
  );

  const toggleDone = useCallback(
    (item: TimelineItem, el: Element | null) => {
      const nowDone = !item.done;
      const next = items.map((i) =>
        i.id === item.id ? { ...i, done: nowDone } : i,
      );
      setItems(next);
      save(next);
      if (nowDone) {
        burstFromElement(el);
        haptic();
        capture("timeline_step_done");
        // Mirror into the linked task step (best-effort).
        if (item.taskId && typeof item.stepIndex === "number") {
          const taskId = item.taskId;
          const stepIndex = item.stepIndex;
          void fetch(`/api/tasks/${taskId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then(
              (
                b: {
                  task?: { completed_steps: boolean[]; steps: unknown[] };
                } | null,
              ) => {
                if (!b?.task) return undefined;
                const completed = b.task.steps.map(
                  (_, i) => b.task?.completed_steps?.[i] ?? false,
                );
                completed[stepIndex] = true;
                return fetch(`/api/tasks/${taskId}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ completed_steps: completed }),
                });
              },
            )
            .catch(() => {});
        }
      }
    },
    [items, save],
  );

  const setDeadline = useCallback(
    (item: TimelineItem, hhmm: string | null) => {
      const next = items.map((i) =>
        i.id === item.id ? { ...i, deadline: hhmm } : i,
      );
      setItems(next);
      save(next);
      setEditing(null);
    },
    [items, save],
  );

  const grantAmnesty = useCallback(() => {
    const ids = new Set(overflow.map((a) => a.id));
    const next = items.filter((i) => !ids.has(i.id));
    setItems(next);
    save(next);
    setOverflowDismissed(true);
    capture("timeline_amnesty", { count: overflow.length });
    setToast("Set down, guilt-free. Today just got honest.");
    window.setTimeout(() => setToast(null), 6000);
  }, [overflow, items, save]);

  // --- render --------------------------------------------------------------
  if (loading) {
    return <p className="animate-fade-in text-muted">Laying out your day…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 text-center">
        <div className="mb-3 text-3xl">🗓️</div>
        <p className="text-text">Nothing on the timeline yet.</p>
        <p className="mt-2 text-muted">
          A morning plan builds it automatically — or break something down and
          it&apos;ll appear here.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href="/plan"
            className="grad-primary rounded-2xl px-5 py-3 font-semibold shadow-soft"
          >
            Morning plan
          </Link>
          <Link
            href="/app"
            className="rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-text"
          >
            Break something down
          </Link>
        </div>
      </div>
    );
  }

  const rows: ReactNode[] = [];

  // The past, gently faded — done things, never "failed", just earlier.
  for (const d of doneItems) {
    rows.push(
      <li key={`done-${d.id}`} className="flex items-center gap-3 opacity-50">
        <span className="w-12 flex-shrink-0 text-right text-xs text-muted">
          ✓
        </span>
        <div className="flex-1 rounded-xl px-3 py-1.5 text-sm text-muted line-through">
          {d.title}
        </div>
      </li>,
    );
  }

  // NOW is always obvious.
  rows.push(<NowLine key="now" now={now} />);

  for (const e of entries) {
    rows.push(
      <Row
        key={`${e.kind}-${e.start}-${e.item?.id ?? e.title}`}
        entry={e}
        editing={editing}
        onEdit={setEditing}
        onDeadline={setDeadline}
        onToggle={toggleDone}
      />,
    );
  }

  return (
    <div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="glass fixed left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl p-4 text-sm text-text shadow-float animate-fade-in"
        >
          {toast}
        </div>
      )}

      {overflow.length > 0 && !overflowDismissed && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4 animate-fade-in">
          <p className="text-sm text-text">
            The day can&apos;t fit everything anymore. These could wait —
            guilt-free, recoverable:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {overflow.map((a) => (
              <li key={a.id}>· {a.title}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={grantAmnesty}
              className="grad-primary rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Set them down
            </button>
            <button
              type="button"
              onClick={() => setOverflowDismissed(true)}
              className="rounded-xl border border-border px-4 py-2 text-sm text-muted"
            >
              Keep them on
            </button>
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-1.5">{rows}</ol>

      {overflow.length > 0 && overflowDismissed && (
        <p className="mt-4 text-center text-sm text-muted">
          {overflow.length} thing{overflow.length > 1 ? "s" : ""} didn&apos;t
          fit before the evening — safe, just not today&apos;s problem.
        </p>
      )}
    </div>
  );
}

function NowLine({ now }: { now: number }) {
  return (
    <li aria-label={`Now, ${minutesToHhmm(now)}`} className="relative py-1">
      {/* The "now" marker is a fine gold rule — quiet, not a glowing bar. */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--gold))]">
          now
        </span>
        <span className="h-px flex-1 bg-[rgb(var(--gold))]" />
        <span data-tabular className="text-xs font-medium text-text">
          {minutesToHhmm(now)}
        </span>
      </div>
    </li>
  );
}

function Row({
  entry,
  editing,
  onEdit,
  onDeadline,
  onToggle,
}: {
  entry: TimelineEntry;
  editing: string | null;
  onEdit: (id: string | null) => void;
  onDeadline: (item: TimelineItem, hhmm: string | null) => void;
  onToggle: (item: TimelineItem, el: Element | null) => void;
}) {
  const time = minutesToHhmm(entry.start);

  if (entry.kind === "break") {
    return (
      <li className="flex items-center gap-3">
        <span className="w-12 flex-shrink-0 text-right text-xs tabular-nums text-muted">
          {time}
        </span>
        <div className="flex-1 rounded-xl border border-dashed border-border/70 px-3 py-2 text-sm text-muted">
          🫁 {entry.title} · {entry.minutes} min
        </div>
      </li>
    );
  }

  if (entry.kind === "buffer") {
    return (
      <li className="flex items-center gap-3">
        <span className="w-12 flex-shrink-0 text-right text-xs tabular-nums text-muted">
          {time}
        </span>
        <div className="flex-1 rounded-xl border border-dashed border-accent/30 bg-accent-soft/30 px-3 py-2 text-sm text-muted">
          🚪 {entry.title}
        </div>
      </li>
    );
  }

  const item = entry.item;
  if (!item) return null;

  return (
    <li className="flex items-start gap-3">
      <span className="w-12 flex-shrink-0 pt-3.5 text-right text-xs tabular-nums text-muted">
        {time}
      </span>
      <div className="glass flex-1 rounded-2xl p-3.5 shadow-soft">
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={false}
            aria-label={`Mark done: ${item.title}`}
            onClick={(e) => onToggle(item, e.currentTarget)}
            className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-border text-transparent transition-colors hover:border-accent/60"
          />
          <div className="min-w-0 flex-1">
            <p className="leading-snug text-text">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              ~{entry.minutes} min
              {entry.startBy !== undefined && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 font-medium text-accent">
                  start by {minutesToHhmm(entry.startBy)}
                </span>
              )}
            </p>
            {editing === item.id ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  defaultValue={item.deadline ?? ""}
                  onChange={(e) => onDeadline(item, e.target.value || null)}
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text"
                />
                <button
                  type="button"
                  onClick={() => onDeadline(item, null)}
                  className="text-xs text-muted hover:text-text"
                >
                  no hard time
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onEdit(item.id)}
                className="mt-1.5 text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
              >
                {item.deadline ? `deadline ${item.deadline}` : "+ hard time?"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
