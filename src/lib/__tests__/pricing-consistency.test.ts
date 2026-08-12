import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRO_FAIR_USE } from "@/lib/quota";
import { TRIAL_DAYS } from "@/lib/stripe";

/**
 * The price is stated in three separate user-facing places: the landing page,
 * the pricing cards, and **Terms §10**. Stripe holds a fourth copy, and the
 * env vars a fifth.
 *
 * A mismatch is not cosmetic. Terms of service quoting a price you do not
 * charge is a consumer-law problem (CPUTR misleading action), and it is the
 * same class of failure AA4 found in the retention schedule: a published
 * statement the system does not honour. It is also very easy to create —
 * changing the price means touching three files and a dashboard.
 *
 * These tests pin every surface to one number. If you change the price,
 * change it here too, deliberately, and the failure list tells you exactly
 * which files still disagree.
 */

const MONTHLY = "£9.99";
const ANNUAL = "£99";

/** Prices that must no longer appear anywhere user-facing. */
const RETIRED = ["£7.99", "£59"];

const SURFACES = [
  "src/app/page.tsx",
  "src/components/PricingCards.tsx",
  "src/app/terms/page.tsx",
];

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("pricing is consistent across every user-facing surface", () => {
  for (const file of SURFACES) {
    it(`${file} states the current monthly price`, () => {
      expect(
        read(file),
        `${file} must state ${MONTHLY}. A price shown to customers that ` +
          `differs from what Stripe charges is a misleading-action risk.`,
      ).toContain(MONTHLY);
    });

    it(`${file} contains no retired price`, () => {
      const src = read(file);
      for (const old of RETIRED) {
        expect(
          src.includes(old),
          `${file} still contains ${old}. Every surface must agree, ` +
            `including Terms §10.`,
        ).toBe(false);
      }
    });
  }

  it("the annual price is stated on the pricing cards and in the Terms", () => {
    expect(read("src/components/PricingCards.tsx")).toContain(ANNUAL);
    expect(read("src/app/terms/page.tsx")).toContain(ANNUAL);
  });

  it("no surface claims 'unlimited' without the fair-use qualifier", () => {
    // Pro carries a real daily ceiling (PRO_FAIR_USE). Any marketing surface
    // that says "unlimited" without qualifying it is making a claim the code
    // does not honour — the same failure AA4 found in the retention schedule.
    for (const file of [
      "src/app/page.tsx",
      "src/components/PricingCards.tsx",
    ]) {
      const src = read(file);
      if (/[Uu]nlimited breakdowns/.test(src)) {
        expect(
          /fair use/i.test(src),
          `${file} says "unlimited breakdowns" but never says "fair use", ` +
            `while the server enforces ${PRO_FAIR_USE.breakdownPerDay}/day.`,
        ).toBe(true);
      }
    }
  });

  it("the Terms state the actual enforced fair-use number", () => {
    // If the ceiling changes in code, the Terms must change with it.
    expect(
      read("src/app/terms/page.tsx"),
      `Terms must state the enforced ceiling of ` +
        `${PRO_FAIR_USE.breakdownPerDay} breakdowns per day.`,
    ).toContain(String(PRO_FAIR_USE.breakdownPerDay));
  });

  it("the fair-use ceiling stays well clear of real usage", () => {
    // ~20/day is the heaviest plausible genuine user. A ceiling that drifted
    // down toward that would start clipping paying customers.
    expect(PRO_FAIR_USE.breakdownPerDay).toBeGreaterThanOrEqual(40);
  });

  it("every stated trial length matches TRIAL_DAYS", () => {
    // The trial is advertised in ~13 places — the landing page, PricingCards,
    // a paywall CTA on nine tool pages, and Terms §10 and §12. Terms §12 ties
    // the consumer cooling-off position to "no charge before the trial ends",
    // so a stale number there is a legal statement that no longer matches the
    // system. Scanning the whole tree means a new surface can't be missed.
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "__tests__") continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;

        const src = readFileSync(full, "utf8");
        const patterns = [/(\d+)-day free trial/g, /Free for (\d+) days/g];
        for (const re of patterns) {
          for (const m of src.matchAll(re)) {
            if (Number(m[1]) !== TRIAL_DAYS) {
              offenders.push(
                `${full.slice(process.cwd().length + 1).replace(/\\/g, "/")}: "${m[0]}"`,
              );
            }
          }
        }
      }
    }

    walk(join(process.cwd(), "src"));

    expect(
      offenders,
      `TRIAL_DAYS is ${TRIAL_DAYS} but these say otherwise:\n  ` +
        offenders.join("\n  "),
    ).toEqual([]);
  });

  it("the annual saving claim is arithmetically true", () => {
    // "2 months free" must actually be 2 months free, or it is a false
    // savings claim — exactly what the CMA looks for in price promotions.
    const monthly = Number(MONTHLY.replace("£", ""));
    const annual = Number(ANNUAL.replace("£", ""));
    const monthsPaidFor = annual / monthly;
    const monthsFree = 12 - monthsPaidFor;

    expect(read("src/components/PricingCards.tsx")).toContain("2 months free");
    // Rounds to 2 — 12 - (99/9.99) = 2.09
    expect(Math.round(monthsFree)).toBe(2);
    // And it must never overstate: the claim cannot exceed the real saving.
    expect(monthsFree).toBeGreaterThanOrEqual(2);
  });
});
