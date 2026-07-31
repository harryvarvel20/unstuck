import { describe, it, expect } from "vitest";
import {
  parseStreamingBreakdown,
  parseStreamingMessage,
  parseItemsArray,
  parseStringsArray,
  parseStringField,
  sanitizeText,
} from "../parseBreakdown";

/**
 * Z1 - strict-JSON handling for every streamed AI surface. The model can send
 * complete, partial, malformed, or empty output; the parser must degrade
 * gracefully (contribute nothing) and never throw. All test buffers are built
 * programmatically (JSON.stringify / fromCharCode) so escapes are unambiguous.
 */

const BACKSLASH = String.fromCharCode(92);
const BEL = String.fromCharCode(7);
const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);

const FULL = JSON.stringify({
  crisis: false,
  total_minutes: 12,
  steps: [
    { title: "Open the doc", minutes: 2, tip: "Just open it." },
    { title: "Write one line", minutes: 10 },
  ],
});

describe("parseStreamingBreakdown - complete output", () => {
  it("parses the full object", () => {
    const r = parseStreamingBreakdown(FULL);
    expect(r.crisis).toBe(false);
    expect(r.totalMinutes).toBe(12);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]).toEqual({
      title: "Open the doc",
      minutes: 2,
      tip: "Just open it.",
    });
  });

  it("parses the crisis shape and never yields steps for it", () => {
    const r = parseStreamingBreakdown(
      JSON.stringify({
        crisis: true,
        message: "You matter. Samaritans 116 123.",
      }),
    );
    expect(r.crisis).toBe(true);
    expect(r.crisisMessage).toContain("116 123");
    expect(r.steps).toHaveLength(0);
  });
});

describe("parseStreamingBreakdown - partial stream", () => {
  it("yields only fully-closed step objects", () => {
    // Cut the full buffer mid-way through the second step object.
    const cut = FULL.indexOf('"Write one line"') + 8;
    const r = parseStreamingBreakdown(FULL.slice(0, cut));
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]?.title).toBe("Open the doc");
  });

  it("handles braces and escaped quotes inside strings", () => {
    const buffer = JSON.stringify({
      crisis: false,
      steps: [{ title: 'Say "hi {loudly}" once', minutes: 3 }],
    });
    const r = parseStreamingBreakdown(buffer);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]?.title).toBe('Say "hi {loudly}" once');
  });

  it("returns an empty result for an empty buffer", () => {
    const r = parseStreamingBreakdown("");
    expect(r).toEqual({
      crisis: false,
      crisisMessage: null,
      totalMinutes: null,
      steps: [],
    });
  });
});

describe("parseStreamingBreakdown - malformed output", () => {
  it("never throws on garbage and contributes nothing", () => {
    const garbageCases = [
      "not json at all",
      JSON.stringify({ steps: "not-an-array" }),
      JSON.stringify({ steps: [{ title: 42, minutes: "x" }] }),
      JSON.stringify({ steps: [{}, { minutes: 5 }] }),
      "<<<html error page>>>",
    ];
    for (const garbage of garbageCases) {
      const r = parseStreamingBreakdown(garbage);
      expect(r.steps).toHaveLength(0);
    }
  });

  it("clamps absurd minutes into the 1-20 range and defaults non-numeric", () => {
    const r = parseStreamingBreakdown(
      JSON.stringify({
        steps: [
          { title: "a", minutes: 9999 },
          { title: "b", minutes: -3 },
          { title: "c", minutes: "7" },
          { title: "d" },
        ],
      }),
    );
    expect(r.steps.map((s) => s.minutes)).toEqual([20, 2, 7, 2]);
  });

  it("strips control characters and angle brackets from model text", () => {
    const r = parseStreamingBreakdown(
      JSON.stringify({
        steps: [{ title: `Do<script>x</script>${BEL} thing`, minutes: 2 }],
      }),
    );
    expect(r.steps[0]?.title).toBe("Doscriptx/script thing");
  });
});

describe("parseStreamingMessage", () => {
  it("types out a still-open string live", () => {
    const full = JSON.stringify({ crisis: false, message: "You're doing ok" });
    const open = full.slice(0, full.indexOf("doing ok"));
    const r = parseStreamingMessage(open);
    expect(r.complete).toBe(false);
    expect(r.message).toBe("You're");
  });

  it("drops a trailing half-finished escape sequence", () => {
    // Buffer ends with an escaped backslash split across chunks.
    const enc = JSON.stringify("line one" + BACKSLASH); // -> "line one\\"
    const buffer = '{"message": ' + enc.slice(0, -1); // strip closing quote
    const r = parseStreamingMessage(buffer);
    expect(r.complete).toBe(false);
    expect(r.message.startsWith("line one")).toBe(true);
  });

  it("reports crisis and the complete message", () => {
    const r = parseStreamingMessage(
      JSON.stringify({ crisis: true, message: "Please reach out - 116 123." }),
    );
    expect(r.crisis).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.message).toContain("116 123");
  });

  it("returns empty for a buffer with no message", () => {
    const r = parseStreamingMessage('{"crisis": fal');
    expect(r.message).toBe("");
    expect(r.complete).toBe(false);
  });
});

describe("parseItemsArray / parseStringsArray / parseStringField", () => {
  it("extracts items with ids and clamps minutes to 1-240", () => {
    const items = parseItemsArray(
      JSON.stringify({ must: [{ id: "x1", title: "Email", minutes: 999 }] }),
      "must",
    );
    expect(items).toEqual([{ id: "x1", title: "Email", minutes: 240 }]);
  });

  it("extracts complete strings and skips a trailing partial", () => {
    const full = JSON.stringify({ captured: ["one", "two", "three"] });
    const cut = full.indexOf('"three"') + 4; // mid-way through "three"
    const out = parseStringsArray(full.slice(0, cut), "captured");
    expect(out).toEqual(["one", "two"]);
  });

  it("bails safely when the array holds objects, not strings", () => {
    const out = parseStringsArray(
      JSON.stringify({ captured: [{ a: 1 }] }),
      "captured",
    );
    expect(out).toEqual([]);
  });

  it("reads a top-level string field or returns null", () => {
    expect(
      parseStringField(JSON.stringify({ name: "Morning reset" }), "name"),
    ).toBe("Morning reset");
    expect(parseStringField('{"nam', "name")).toBeNull();
  });
});

describe("sanitizeText", () => {
  it("removes control chars and angle brackets, keeps tabs/newlines", () => {
    expect(sanitizeText(`a b<c>${TAB}d${NL}e`)).toBe(`a bc${TAB}d${NL}e`);
    expect(sanitizeText(`x${BEL}y`)).toBe("xy");
  });
});
