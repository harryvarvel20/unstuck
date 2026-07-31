import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" -> "src/*" so route modules import cleanly.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pure-logic units + mocked route handlers (no DOM render). The live-DB
    // and browser suites (RLS harness, Playwright E2E, axe, Lighthouse) run
    // separately — see reports/TEST-REPORT.md.
    globals: false,
  },
});
