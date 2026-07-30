import { describe, it, expect } from "vitest";
import {
  validateHandle,
  normalizeHandle,
  suggestHandle,
  HANDLE_MAX,
} from "../username";

const ZWSP = String.fromCharCode(0x200b); // zero-width space
const LIGATURE_FI = String.fromCharCode(0xfb01); // "fi" ligature, NFKC -> "fi"
const CYRILLIC_A = String.fromCharCode(0x0430); // looks like Latin "a"
const EMOJI = String.fromCharCode(0xd83d, 0xde00); // 😀

describe("normalizeHandle", () => {
  it("trims, lowercases, and NFKC-folds", () => {
    expect(normalizeHandle("  Sunny_Otter  ")).toBe("sunny_otter");
    expect(normalizeHandle(`${LIGATURE_FI}sh_tank`)).toBe("fish_tank");
  });
  it("strips zero-width characters", () => {
    expect(normalizeHandle(`bo${ZWSP}b_cat`)).toBe("bob_cat");
  });
});

describe("validateHandle - accepts", () => {
  it("a clean handle", () => {
    const r = validateHandle("sunny_otter_42");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key).toBe("sunny_otter_42");
  });
  it("dots and underscores in the middle", () => {
    expect(validateHandle("a.b_c").ok).toBe(true);
  });
  it("is case-insensitive via the key", () => {
    const a = validateHandle("SunnyOtter");
    const b = validateHandle("sunnyotter");
    expect(a.ok && b.ok && a.key === b.key).toBe(true);
  });
});

describe("validateHandle - rejects", () => {
  const cases: [string, string][] = [
    ["", "empty"],
    ["ab", "too_short"],
    ["a".repeat(HANDLE_MAX + 1), "too_long"],
    ["bad space", "charset"],
    [`emoji${EMOJI}name`, "charset"],
    ["_leading", "separator"],
    ["trailing_", "separator"],
    ["double__under", "separator"],
    ["dot.._dot", "separator"],
    ["admin", "reserved"],
    ["a.d.m.i.n", "reserved"], // separator-evasion still blocked
    ["adhv", "reserved"],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${expected}`, () => {
      const r = validateHandle(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe(expected);
    });
  }

  it("blocks homoglyph/confusable (Cyrillic) characters", () => {
    const r = validateHandle(`${CYRILLIC_A}dmin_x`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("charset");
  });
});

describe("suggestHandle", () => {
  it("always produces a valid, in-length, non-empty suggestion", () => {
    for (let i = 0; i < 200; i++) {
      const s = suggestHandle();
      expect(s.length).toBeLessThanOrEqual(HANDLE_MAX);
      expect(validateHandle(s).ok).toBe(true);
    }
  });
});
