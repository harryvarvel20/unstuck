import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
