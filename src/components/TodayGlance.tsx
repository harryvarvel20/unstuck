"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildTimeline,
  minutesToHhmm,
  type TimelineItem,
} from "@/lib/timeline";

/**
 * "Today at a glance" — an inline sidebar card for the desktop workspace.
 * Read-only context beside Home: the next few timeline blocks and one link.
 * Self-hides when there's nothing useful (signed out, free plan, empty day).
 */
export function TodayGlance({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      try {
        const res = await fetch("/api/today");
        if (!res.ok) return; // free plan / signed out → stays hidden
        const body = (await res.json()) as {
          items: TimelineItem[];
          ratio: number;
        };
        setItems(body.items);
        setRatio(body.ratio);
      } catch {
        /* stay hidden */
      }
    })();
  }, [enabled]);

  const upcoming = useMemo(() => {
    if (!items || items.length === 0) return [];
    const now = new Date();
    const { entries } = buildTimeline(items, {
      startAt: Math.max(now.getHours() * 60 + now.getMinutes(), 6 * 60),
      ratio,
    });
    return entries.filter((e) => e.kind === "task").slice(0, 4);
  }, [items, ratio]);

  if (!enabled || upcoming.length === 0) return null;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Today at a glance
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {upcoming.map((e) => (
          <li
            key={`${e.start}-${e.title}`}
            className="flex items-start gap-2.5"
          >
            <span className="mt-0.5 w-11 flex-shrink-0 text-right text-xs tabular-nums text-accent">
              {minutesToHhmm(e.start)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-text">
              {e.title}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/today"
        className="mt-4 block text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        Open the timeline →
      </Link>
    </div>
  );
}
