import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pure-logic units only for now (no DOM/component render). The live DB and
    // browser-dependent suites (RLS harness, Playwright E2E, axe, Lighthouse)
    // run separately — see reports/TEST-REPORT.md.
    globals: false,
  },
});
