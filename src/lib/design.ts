/**
 * ADHV design tokens — the single source of truth for motion and the
 * "alive but calm" system. Colours live as CSS variables in globals.css;
 * this file holds the JS-side values (durations, springs, haptics) that
 * components import so every phase stays consistent.
 *
 * CONSTRAINT: modern ≠ busy. Max one animated element per view. Dopamine
 * comes from motion *quality*, not quantity.
 */

/** Motion durations in ms. Keep interactions snappy, ambient stuff slow. */
export const MOTION = {
  tap: 120,
  pop: 320,
  transition: 260,
  celebrate: 600,
  ambient: 18000,
} as const;

/** CSS spring-ish easings (cubic-bezier) for a springy, physical feel. */
export const EASE = {
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/** True when the user asked for less motion — every animation must check this. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/** True on touch-capable devices — haptic-feel is touch-only (no fake buzz on desktop). */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** A tiny haptic tick on touch devices (no-op elsewhere, respects RM). */
export function haptic(pattern: number | number[] = 8): void {
  if (typeof navigator === "undefined") return;
  if (!isTouchDevice()) return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/**
 * Responsive tokens (Phase T). Breakpoints match Tailwind's defaults so CSS
 * and JS agree; container widths keep content a calm reading column.
 */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
export const CONTAINER = {
  /** Main reading column (existing max-w-xl ≈ 36rem). */
  column: "36rem",
  /** Marketing pages (max-w-2xl ≈ 42rem). */
  wide: "42rem",
  /** Left nav rail width on md+. */
  rail: "4rem",
  /** Right context panel width on xl+. */
  panel: "18rem",
} as const;
