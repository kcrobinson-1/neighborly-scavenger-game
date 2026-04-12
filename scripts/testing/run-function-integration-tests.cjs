const path = require("node:path");

const {
  buildCompletionPayload,
  createFunctionIntegrationClient,
} = require("./function-integration-client.cjs");
const {
  startFunctionsServe,
  stopFunctionsServe,
  writeFunctionsServeEnvFile,
} = require("./function-runtime.cjs");
const {
  ensureDockerRuntime,
  fs,
  isSupabaseStackRunning,
  logStep,
  readSupabaseStatus,
  resetLocalSupabaseDatabase,
  startLocalSupabaseStack,
  stopLocalSupabaseStack,
  tmpRoot,
} = require("./utils.cjs");

const lockPath = `${tmpRoot}/test-functions-integration.lock`;
const serveEnvPath = path.join(tmpRoot, "test-functions.env");
const serveReadyTimeoutMs = 20_000;
const completionAttemptCount = 3;
const sessionSigningSecret = "local-trust-path-test-secret";
const allowedOrigins = ["http://127.0.0.1:4173", "http://localhost:4173"];
const allowedOrigin = allowedOrigins[0];

function acquireLock() {
  fs.mkdirSync(tmpRoot, { recursive: true });

  try {
    const handle = fs.openSync(lockPath, "wx");
    fs.writeFileSync(handle, String(process.pid));

    return () => {
      fs.closeSync(handle);
      fs.rmSync(lockPath, { force: true });
    };
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new Error(
        "Another trust-path integration run is already in progress. Wait for it to finish before starting a second `npm run test:functions:integration`.",
      );
    }

    throw error;
  }
}

async function main() {
  let startedLocalStack = false;
  const releaseLock = acquireLock();

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

    if (!status?.FUNCTIONS_URL || !status.PUBLISHABLE_KEY) {
      throw new Error("Local Supabase status did not include the Functions URL and publishable key.");
    }

    writeFunctionsServeEnvFile(serveEnvPath, {
      allowedOrigins,
      sessionSigningSecret,
    });

    logStep("Starting local Edge Functions runtime");
    const serveRuntime = startFunctionsServe(serveEnvPath);

    try {
      const functionClient = createFunctionIntegrationClient({
        allowedOrigin,
        completionAttemptCount,
        logStep,
        readyTimeoutMs: serveReadyTimeoutMs,
        serveRuntime,
        status,
      });
      const requestId = `trust-path-${Date.now()}`;
      const completionPayload = buildCompletionPayload(requestId);

      logStep("Waiting for local Edge Functions to become ready");
      logStep("Issuing a backend session and capturing the signed cookie");
      const issueSession = await functionClient.waitForIssueSessionReady();
      const cookieHeader = functionClient.extractSessionCookie(issueSession);

      logStep("Warming the complete-quiz function before the trusted completion");
      await functionClient.waitForCompleteQuizReady();

      logStep("Completing the quiz with the cookie transport");
      const cookieCompletion = await functionClient.completeQuizWithCookie(
        cookieHeader,
        completionPayload,
      );
      functionClient.assertTrustedCookieCompletion(cookieCompletion);

      logStep("Retrying the same completion via the explicit session header fallback");
      const repeatedCompletion = await functionClient.completeQuizWithSessionHeader(
        issueSession.body.sessionToken,
        completionPayload,
      );
      functionClient.assertHeaderFallbackRetry(repeatedCompletion, cookieCompletion);
    } finally {
      logStep("Stopping local Edge Functions runtime");
      await stopFunctionsServe(serveRuntime.child);
      fs.rmSync(serveEnvPath, { force: true });
    }
  } finally {
    if (startedLocalStack) {
      stopLocalSupabaseStack();
    }

    releaseLock();
  }
}

main().catch((error) => {
  console.error(`\nLocal function integration setup failed.\n${error.message}`);
  process.exit(1);
});
