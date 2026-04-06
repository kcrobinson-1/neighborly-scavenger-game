const {
  ensureDenoAvailable,
  ensureDockerRuntime,
  hasPlaywrightChromium,
  logStep,
  run,
} = require("./utils.cjs");

function main() {
  logStep("Checking Docker runtime for Supabase database tests");
  ensureDockerRuntime();

  logStep("Checking Deno for Edge Function validation");
  ensureDenoAvailable();

  if (hasPlaywrightChromium()) {
    logStep("Playwright Chromium is already installed");
  } else {
    logStep("Installing Playwright Chromium");
    run("npx", ["playwright", "install", "chromium"]);
  }

  console.log("\nLocal testing prerequisites are ready.");
  console.log("Run `npm run validate:local` to execute the full local validation flow.");
}

try {
  main();
} catch (error) {
  console.error(`\nLocal test setup failed.\n${error.message}`);
  process.exit(1);
}
