const {
  ensureDockerRuntime,
  fs,
  isSupabaseStackRunning,
  logStep,
  resetLocalSupabaseDatabase,
  readSupabaseStatus,
  run,
  startLocalSupabaseStack,
  stopLocalSupabaseStack,
  tmpRoot,
} = require("./utils.cjs");
const {
  startFunctionsServe,
  stopFunctionsServe,
  writeFunctionsServeEnvFile,
} = require("./function-runtime.cjs");

const serveReadyTimeoutMs = 20_000;
const servePollIntervalMs = 250;
const functionsEnvPath = `${tmpRoot}/test-admin-e2e-functions.env`;

async function waitForAuthoringFunctionsReady(status) {
  const deadline = Date.now() + serveReadyTimeoutMs;
  let lastFailure = "No response yet.";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${status.FUNCTIONS_URL}/save-draft`, {
        body: "{}",
        headers: {
          Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
          apikey: status.PUBLISHABLE_KEY,
          origin: "http://127.0.0.1:4173",
        },
        method: "POST",
      });

      if ([400, 401].includes(response.status)) {
        return;
      }

      lastFailure = `Unexpected status: ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, servePollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for save-draft to become ready in local functions runtime. Last failure: ${lastFailure}`,
  );
}

async function main() {
  let startedLocalStack = false;
  let functionsRuntime = null;

  try {
    logStep("Checking Docker runtime for local Supabase");
    ensureDockerRuntime();

    if (isSupabaseStackRunning()) {
      logStep("Reusing existing local Supabase stack");
    } else {
      startedLocalStack = startLocalSupabaseStack();
    }

    if (process.env.NEIGHBORLY_SKIP_DB_RESET !== "1") {
      resetLocalSupabaseDatabase();
    }

    const status = readSupabaseStatus();

    if (!status?.API_URL || !status.PUBLISHABLE_KEY || !status.SERVICE_ROLE_KEY) {
      throw new Error(
        "Local Supabase status did not include API_URL, PUBLISHABLE_KEY, and SERVICE_ROLE_KEY.",
      );
    }

    writeFunctionsServeEnvFile(functionsEnvPath, {
      allowedOrigins: ["http://127.0.0.1:4173", "http://localhost:4173"],
      sessionSigningSecret: "local-admin-e2e-session-secret",
    });

    logStep("Starting local Edge Functions runtime");
    functionsRuntime = startFunctionsServe(functionsEnvPath);

    logStep("Waiting for local authoring function runtime");
    await waitForAuthoringFunctionsReady(status);

    logStep("Running admin Playwright e2e suite");
    run("npx", ["playwright", "test", "-c", "playwright.admin.config.ts"], {
      env: {
        VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: status.PUBLISHABLE_KEY,
        VITE_SUPABASE_URL: status.API_URL,
        TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        TEST_SUPABASE_URL: status.API_URL,
      },
    });
  } finally {
    if (functionsRuntime) {
      logStep("Stopping local Edge Functions runtime");
      await stopFunctionsServe(functionsRuntime.child);
      fs.rmSync(functionsEnvPath, { force: true });
    }

    if (startedLocalStack) {
      stopLocalSupabaseStack();
    }
  }
}

main().catch((error) => {
  console.error(`\nLocal admin e2e validation failed.\n${error.message}`);
  process.exit(1);
});
