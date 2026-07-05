/**
 * The one ambient animation: a slow sage→olive gradient mesh behind
 * everything. GPU-cheap (a single transformed, blurred layer), fixed, and
 * auto-frozen under prefers-reduced-motion (handled in globals.css).
 */
export function MeshBackground() {
  return <div className="mesh" aria-hidden="true" />;
}
