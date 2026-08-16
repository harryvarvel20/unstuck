/**
 * The static background material (Old Money), in three layers back to front:
 *
 *   .backdrop  an OPTIONAL photograph at `public/backdrop.jpg`, desaturated
 *              and toned to the palette. If the file is absent the CSS
 *              background simply doesn't paint — no broken image, nothing to
 *              remove. Drop a file in to switch it on.
 *   .mesh      marbled endpaper (::before) + a whisper of aged gold, with a
 *              linen grain over it (::after).
 *
 * No motion in any of them. Styled entirely by globals.css.
 */
export function MeshBackground() {
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <div className="mesh" aria-hidden="true" />
    </>
  );
}
