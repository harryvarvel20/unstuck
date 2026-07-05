"use client";

import { useEffect } from "react";

/**
 * Escape-closes-overlay — keyboard parity for every full-screen flow.
 * Pass `active` so the listener only exists while the overlay is open.
 */
export function useEscape(onClose: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, active]);
}
