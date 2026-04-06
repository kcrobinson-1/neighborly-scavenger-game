import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The shared-domain tests are happy in Node, but the frontend hook tests
    // need a browser-like environment. Using one jsdom config keeps the early
    // test rollout simple while we build out the rest of the suite.
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
