import { prefersReducedMotion } from "./design";

/**
 * Acknowledgement seal (Phase X4 "Old Money" redesign) — replaces the old
 * colourful confetti burst. Draws ONE quietly-appearing thin gold ring with a
 * check, at a screen point; it fades on its own. Understated acknowledgement,
 * not spectacle. The public name (`burstConfetti`) is unchanged so every
 * existing call site (step complete, reward earned, homework done, routine
 * finished) inherits the new, restrained cue with no edits.
 *
 * No-op under reduced motion. Self-cleans.
 */
export function burstConfetti(x: number, y: number, _count = 14): void {
  if (typeof document === "undefined") return;
  if (prefersReducedMotion()) return;

  const seal = document.createElement("span");
  seal.className = "seal-mark";
  seal.textContent = "✓";
  seal.style.left = `${x}px`;
  seal.style.top = `${y}px`;
  document.body.appendChild(seal);
  window.setTimeout(() => seal.remove(), 950);
}

/** Convenience: seal from the centre of an element (e.g. a tapped checkbox). */
export function burstFromElement(el: Element | null): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burstConfetti(r.left + r.width / 2, r.top + r.height / 2);
}
