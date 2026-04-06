import { defineConfig, devices } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
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
