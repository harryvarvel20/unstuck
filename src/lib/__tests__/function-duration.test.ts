import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GEMINI_STREAM_TIMEOUT_MS } from "../geminiStream";

/**
 * Regression guard for AA3-D1.
 *
 * Vercel Functions run under fluid compute with a **default maxDuration of 300
 * seconds** on both Hobby and Pro. Nothing in this repo declared a duration, so
 * every route — including the ones that call Gemini — could hold a function
 * instance for five minutes if an upstream call stalled.
 *
 * Rule enforced here: any route that talks to Gemini must declare an explicit
 * `maxDuration`, and it must be long enough for a real streamed breakdown but
 * far below the platform default. A new AI route added without one fails here
 * rather than quietly becoming a five-minute cost liability in production.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

/** Markers that mean "this route spends money at Google". */
const GEMINI_MARKERS = [
  "getGemini",
  "streamGeminiJson",
  "BREAKDOWN_MODEL",
  "@/lib/gemini",
];

/** Bounds for an AI route: generous enough to stream, tight enough to matter. */
const AI_MIN_SECONDS = 30;
const AI_MAX_SECONDS = 60;

/** Vercel Pro's generally-available ceiling (800s); nothing here should approach it. */
const PLATFORM_MAX_SECONDS = 800;

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

function relative(path: string): string {
  return path.slice(process.cwd().length + 1).replace(/\\/g, "/");
}

function readMaxDuration(source: string): number | null {
  const match = source.match(/^export const maxDuration = (\d+);/m);
  return match?.[1] ? Number(match[1]) : null;
}

const routeFiles = findRouteFiles(API_DIR);
const geminiRoutes = routeFiles.filter((f) => {
  const src = readFileSync(f, "utf8");
  return GEMINI_MARKERS.some((m) => src.includes(m));
});

describe("Vercel function duration is bounded", () => {
  it("finds the API routes to check", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    expect(geminiRoutes.length).toBeGreaterThan(0);
  });

  for (const file of geminiRoutes) {
    const name = relative(file);
    it(`${name} declares an explicit maxDuration`, () => {
      const secs = readMaxDuration(readFileSync(file, "utf8"));
      expect(
        secs,
        `${name} calls Gemini but declares no \`export const maxDuration\`. ` +
          `It would inherit Vercel's 300s fluid-compute default, so one ` +
          `stalled upstream call could hold a function instance for five ` +
          `minutes. Add \`export const maxDuration = ${AI_MAX_SECONDS};\`.`,
      ).not.toBeNull();
      expect(secs).toBeGreaterThanOrEqual(AI_MIN_SECONDS);
      expect(secs).toBeLessThanOrEqual(AI_MAX_SECONDS);
    });
  }

  it("no route declares a duration beyond the Pro ceiling", () => {
    for (const file of routeFiles) {
      const secs = readMaxDuration(readFileSync(file, "utf8"));
      if (secs !== null) {
        expect(
          secs,
          `${relative(file)} exceeds Pro's limit`,
        ).toBeLessThanOrEqual(PLATFORM_MAX_SECONDS);
      }
    }
  });

  it("the Gemini abort fires before the platform kills the function", () => {
    // The stream must fail on our terms — logged and closed cleanly — rather
    // than being terminated mid-flight by Vercel.
    expect(GEMINI_STREAM_TIMEOUT_MS).toBeLessThan(AI_MAX_SECONDS * 1000);
  });
});
