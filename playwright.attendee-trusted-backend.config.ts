import { defineConfig, devices } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/mobile-smoke.trusted-backend.spec.ts",
  outputDir: "tmp/playwright/test-results-attendee-trusted-backend",
  reporter: "list",
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:web:test",
    env: {
      VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK:
        process.env.VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK ?? "false",
      VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
        process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "",
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "",
    },
    reuseExistingServer: false,
    url: baseUrl,
  },
  projects: [
    {
      name: "mobile-chromium-attendee-trusted-backend",
      use: {
        browserName: "chromium",
        ...devices["iPhone 13"],
      },
    },
  ],
});
