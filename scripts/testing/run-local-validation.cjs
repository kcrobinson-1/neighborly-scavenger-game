const {
  ensureDenoAvailable,
  hasPlaywrightChromium,
  logStep,
  run,
} = require("./utils.cjs");

function main() {
  ensureDenoAvailable();

  if (!hasPlaywrightChromium()) {
    throw new Error(
      "Playwright Chromium is not installed. Run `npm run test:setup:local` or `npm run test:e2e:install` first.",
    );
  }

  // This intentionally mirrors the repo's validation surfaces so contributors
  // can run one command locally instead of remembering the full checklist.
  const steps = [
    ["Lint", ["npm", ["run", "lint"]]],
    ["Unit tests", ["npm", ["run", "test"]]],
    ["Browser smoke tests", ["npm", ["run", "test:e2e"]]],
    ["Database tests", ["npm", ["run", "test:db"]]],
    ["Web build", ["npm", ["run", "build:web"]]],
    ["Check issue-session function", ["deno", ["check", "--no-lock", "supabase/functions/issue-session/index.ts"]]],
    ["Check complete-quiz function", ["deno", ["check", "--no-lock", "supabase/functions/complete-quiz/index.ts"]]],
  ];

  for (const [label, [command, args]] of steps) {
    logStep(label);
    run(command, args);
  }
}

try {
  main();
} catch (error) {
  console.error(`\nLocal validation failed.\n${error.message}`);
  process.exit(1);
}
