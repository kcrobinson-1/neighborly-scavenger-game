const {
  ensureDockerRuntime,
  fs,
  isSupabaseStackRunning,
  logStep,
  readSupabaseStatus,
  resetLocalSupabaseDatabase,
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

const functionsEnvPath = `${tmpRoot}/test-attendee-trusted-backend-e2e-functions.env`;
const servePollIntervalMs = 250;
const serveReadyTimeoutMs = 20_000;

async function waitForAttendeeFunctionsReady(status) {
  const deadline = Date.now() + serveReadyTimeoutMs;
  let lastFailure = "No response yet.";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${status.FUNCTIONS_URL}/issue-session`, {
        body: JSON.stringify({ event_id: "madrona-music-2026" }),
        headers: {
          Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
          apikey: status.PUBLISHABLE_KEY,
          origin: "http://127.0.0.1:4173",
        },
        method: "POST",
      });

      if (response.status === 200) {
        const payload = await response.json();
        const setCookie = response.headers.get("set-cookie");

        if (
          payload?.sessionReady === true &&
          typeof payload?.sessionToken === "string" &&
          payload.sessionToken.length > 0 &&
          typeof setCookie === "string" &&
          setCookie.length > 0
        ) {
          return;
        }

        lastFailure = "Issue-session readiness payload was incomplete.";
      } else {
        lastFailure = `Unexpected status: ${response.status}`;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, servePollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for issue-session to become ready in local functions runtime. Last failure: ${lastFailure}`,
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
      sessionSigningSecret: "local-attendee-trusted-backend-e2e-session-secret",
    });

    logStep("Starting local Edge Functions runtime");
    functionsRuntime = startFunctionsServe(functionsEnvPath);

    logStep("Waiting for attendee function runtime");
    await waitForAttendeeFunctionsReady(status);

    logStep("Running trusted-backend attendee Playwright smoke suite");
    run("npx", ["playwright", "test", "-c", "playwright.attendee-trusted-backend.config.ts"], {
      env: {
        TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        TEST_SUPABASE_URL: status.API_URL,
        VITE_ENABLE_LOCAL_PROTOTYPE_FALLBACK: "false",
        VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: status.PUBLISHABLE_KEY,
        VITE_SUPABASE_URL: status.API_URL,
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
  console.error(`\nLocal attendee trusted-backend e2e validation failed.\n${error.message}`);
  process.exit(1);
});
