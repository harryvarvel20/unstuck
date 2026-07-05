"use client";

import { useEffect } from "react";
import { capture, EVENTS } from "@/lib/analytics";

/** Fires the `subscribed` event once when the post-checkout welcome shows. */
export function WelcomeTrack() {
  useEffect(() => {
    capture(EVENTS.subscribed);
  }, []);
  return null;
}
