import { defineConfig, devices } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/mobile-smoke.spec.ts",
  outputDir: "tmp/playwright/test-results",
  reporter: "list",
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:web:test",
    env: {
      VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK: "true",
      // Force the smoke suite onto the explicit local fallback path so inherited
      // shell env does not accidentally switch the test onto a remote backend.
      VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "",
      VITE_SUPABASE_URL: "",
    },
    reuseExistingServer: !process.env.CI,
    url: baseUrl,
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        // We keep the smoke suite on Chromium because the repo already uses it
        // for UI review and it is the lowest-friction browser target for CI.
        browserName: "chromium",
        ...devices["iPhone 13"],
      },
    },
  ],
});
