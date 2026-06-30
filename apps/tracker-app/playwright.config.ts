import { defineConfig, devices } from "@playwright/test";

// Local E2E / visual checks. Drives the HMR dev server (Vite :5173 + proxied
// wrangler API). Seed first with `npm run seed:local` so boards are populated.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Auto-start the dev stack; reuse it if you already have `npm run dev:local` up.
  webServer: {
    command: "npm run dev:local",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
