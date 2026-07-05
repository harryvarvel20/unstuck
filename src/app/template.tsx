"use client";

/**
 * Per-navigation page transition. A subtle fade+rise on every route change —
 * one animated element, and neutralised under prefers-reduced-motion via the
 * global rule in globals.css. Templates remount on navigation, so the CSS
 * animation replays each time.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
