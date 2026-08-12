import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// `.mts`, not `.ts`: Vite 7 loads config natively and warns that ESM syntax in
// a file treated as CommonJS will stop working when `configLoader: 'native'`
// becomes the default. The extension makes the module system explicit.
//
// That also rules out `__dirname`, which does not exist in ESM — hence the
// import.meta.url form below rather than path.resolve(__dirname, "src").
export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" -> "src/*" so route modules import cleanly.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
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
