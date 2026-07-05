export type Course = "appetiser" | "entree" | "side" | "special";

export interface DopaItem {
  id: string;
  course: Course;
  text: string;
  minutes: number;
  shows: number;
  picks: number;
}

export const COURSES: {
  key: Course;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  {
    key: "appetiser",
    label: "Appetisers",
    hint: "2–5 min boosts",
    emoji: "🥂",
  },
  { key: "entree", label: "Entrées", hint: "30+ min", emoji: "🍽️" },
  { key: "side", label: "Sides", hint: "add-ons", emoji: "🥗" },
  { key: "special", label: "Specials", hint: "occasional treats", emoji: "✨" },
];

/**
 * Pick up to THREE menu items sized to the time available, biased toward
 * novelty (least-picked first). Pure — no I/O.
 * - <=5 min  → appetisers
 * - <=20 min → appetisers + sides
 * - >20 min  → entrées + sides, an occasional special
 */
export function chooseDopamine(items: DopaItem[], minutes: number): DopaItem[] {
  const eligibleCourses: Course[] =
    minutes <= 5
      ? ["appetiser"]
      : minutes <= 20
        ? ["appetiser", "side"]
        : ["entree", "side", "special"];

  const pool = items.filter(
    (i) => eligibleCourses.includes(i.course) && i.minutes <= minutes + 5,
  );
  const fallback = pool.length > 0 ? pool : items;

  // Novelty: fewest picks first, then fewest shows, with a little jitter.
  const scored = [...fallback]
    .map((i) => ({ i, s: i.picks * 3 + i.shows + Math.random() }))
    .sort((a, b) => a.s - b.s);

  // Vary the courses across the three where possible.
  const out: DopaItem[] = [];
  const usedCourse = new Set<Course>();
  for (const { i } of scored) {
    if (out.length >= 3) break;
    if (usedCourse.has(i.course) && out.length < scored.length) {
      const remainingNewCourse = scored.some(
        ({ i: j }) => !usedCourse.has(j.course) && !out.includes(j),
      );
      if (remainingNewCourse) continue;
    }
    out.push(i);
    usedCourse.add(i.course);
  }
  return out.slice(0, 3);
}

/** Items shown a lot but almost never picked drift to the bottom / out. */
export function isStale(i: DopaItem): boolean {
  return i.shows >= 6 && i.picks === 0;
}
