"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

/**
 * Initialises PostHog in cookieless mode (memory persistence — no cookies,
 * no cross-session fingerprint) and captures pageviews on route change.
 * No-ops when NEXT_PUBLIC_POSTHOG_KEY isn't set, so local dev stays clean.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  useEffect(() => {
    if (!key) return;
    if (typeof window === "undefined") return;
    if ((window as unknown as { __ph?: boolean }).__ph) return;
    (window as unknown as { __ph?: boolean }).__ph = true;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
      persistence: "memory", // cookieless
      capture_pageview: false, // we send them manually on route change
      autocapture: false,
      disable_session_recording: true,
    });
    // Expose for the lightweight capture() wrapper used across the app.
    (window as unknown as { posthog?: typeof posthog }).posthog = posthog;
  }, [key]);

  useEffect(() => {
    if (!key) return;
    posthog.capture("$pageview", { $current_url: pathname });
  }, [pathname, key]);

  return <>{children}</>;
}
