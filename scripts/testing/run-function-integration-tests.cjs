const path = require("node:path");

const { startFunctionsServe, stopFunctionsServe } = require("./function-runtime.cjs");
const {
  assertHttpStatus,
  formatHttpResult,
  invokeJson,
} = require("./http-json.cjs");
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
const allowedOrigin = "http://127.0.0.1:4173";

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

function writeServeEnvFile() {
  fs.mkdirSync(tmpRoot, { recursive: true });

  // The local Edge Functions runtime injects the reserved SUPABASE_* values
  // itself, so the env file only needs the repo-owned trust configuration.
  fs.writeFileSync(
    serveEnvPath,
    [
      `SESSION_SIGNING_SECRET=${sessionSigningSecret}`,
      `ALLOWED_ORIGINS=${allowedOrigin},http://localhost:4173`,
      "",
    ].join("\n"),
  );
}

async function waitForServeReady(status, serveRuntime) {
  const deadline = Date.now() + serveReadyTimeoutMs;
  const baseHeaders = {
    Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    apikey: status.PUBLISHABLE_KEY,
    origin: allowedOrigin,
  };
  let lastFailureDetails = "";

  while (Date.now() < deadline) {
    if (serveRuntime.child.exitCode !== null) {
      throw new Error(
        [
          "`supabase functions serve` exited before the local integration test became ready.",
          "If another functions runtime is already bound to the local Supabase ports, stop it and rerun this command.",
          serveRuntime.getOutput(),
        ].filter(Boolean).join("\n\n"),
      );
    }

    try {
      const issueSession = await invokeJson(`${status.FUNCTIONS_URL}/issue-session`, {
        body: "{}",
        headers: baseHeaders,
        method: "POST",
      });

      if (
        issueSession.response.status === 200 &&
        issueSession.body?.sessionReady === true &&
        typeof issueSession.body?.sessionToken === "string" &&
        issueSession.body.sessionToken.length > 0
      ) {
        return issueSession;
      }

      lastFailureDetails =
        `status=${issueSession.response.status} body=${JSON.stringify(issueSession.body)}`;
    } catch {
      // Keep polling until the local gateway finishes reloading the function runtime.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    [
      "Timed out waiting for `supabase functions serve` to return a ready issue-session response.",
      lastFailureDetails,
      serveRuntime.getOutput(),
    ].filter(Boolean).join("\n\n"),
  );
}

async function waitForCompleteQuizReady(status, serveRuntime) {
  const deadline = Date.now() + serveReadyTimeoutMs;
  const baseHeaders = {
    Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    apikey: status.PUBLISHABLE_KEY,
    origin: allowedOrigin,
  };
  let lastFailureDetails = "";

  while (Date.now() < deadline) {
    if (serveRuntime.child.exitCode !== null) {
      throw new Error(
        [
          "`supabase functions serve` exited before complete-quiz became ready.",
          "If another functions runtime is already bound to the local Supabase ports, stop it and rerun this command.",
          serveRuntime.getOutput(),
        ].filter(Boolean).join("\n\n"),
      );
    }

    try {
      const completeQuiz = await invokeJson(`${status.FUNCTIONS_URL}/complete-quiz`, {
        body: JSON.stringify(buildCompletionPayload(`warmup-${Date.now()}`)),
        headers: baseHeaders,
        method: "POST",
      });

      if (
        completeQuiz.response.status === 401 &&
        completeQuiz.body?.error === "Session is missing or invalid."
      ) {
        return;
      }

      lastFailureDetails = formatHttpResult(completeQuiz);
    } catch (error) {
      lastFailureDetails = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    [
      "Timed out waiting for `supabase functions serve` to return a ready complete-quiz response.",
      lastFailureDetails,
      serveRuntime.getOutput(),
    ].filter(Boolean).join("\n\n"),
  );
}

function assertWithContext(condition, message, context) {
  if (!condition) {
    throw new Error(`${message}\n${context}`);
  }
}

function buildCompletionPayload(requestId) {
  return {
    answers: {
      q1: ["a"],
      q2: ["b"],
      q3: ["b"],
      q4: ["a"],
      q5: ["b"],
      q6: ["a"],
    },
    durationMs: 1_200,
    eventId: "madrona-music-2026",
    requestId,
  };
}

function shouldRetryCompletion(result) {
  return [500, 502, 503, 504].includes(result.response.status);
}

async function invokeCompletionWithRetry(label, url, init) {
  let lastResult = null;
  let lastError = null;

  for (let attempt = 1; attempt <= completionAttemptCount; attempt += 1) {
    try {
      lastResult = await invokeJson(url, init);
      lastError = null;
    } catch (error) {
      lastError = error;

      if (attempt === completionAttemptCount) {
        break;
      }

      logStep(
        `${label} request failed; retrying after local Edge Function warmup (${attempt}/${completionAttemptCount})`,
      );
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      continue;
    }

    if (!shouldRetryCompletion(lastResult) || attempt === completionAttemptCount) {
      return lastResult;
    }

    logStep(
      `${label} returned ${lastResult.response.status}; retrying after local Edge Function warmup (${attempt}/${completionAttemptCount})`,
    );
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }

  if (lastResult) {
    return lastResult;
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} request failed after ${completionAttemptCount} attempts.\n${errorMessage}`);
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

    writeServeEnvFile();

    logStep("Starting local Edge Functions runtime");
    const serveRuntime = startFunctionsServe(serveEnvPath);

    try {
      const baseHeaders = {
        Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        apikey: status.PUBLISHABLE_KEY,
        origin: allowedOrigin,
      };
      const requestId = `trust-path-${Date.now()}`;

      logStep("Waiting for local Edge Functions to become ready");
      logStep("Issuing a backend session and capturing the signed cookie");
      const issueSession = await waitForServeReady(status, serveRuntime);

      const setCookieHeader = issueSession.response.headers.get("set-cookie");

      assertWithContext(
        setCookieHeader,
        "Expected issue-session to return Set-Cookie.",
        formatHttpResult(issueSession),
      );

      const cookieHeader = setCookieHeader.split(";")[0];

      logStep("Warming the complete-quiz function before the trusted completion");
      await waitForCompleteQuizReady(status, serveRuntime);

      logStep("Completing the quiz with the cookie transport");
      const cookieCompletion = await invokeCompletionWithRetry(
        "Cookie completion",
        `${status.FUNCTIONS_URL}/complete-quiz`,
        {
          body: JSON.stringify(buildCompletionPayload(requestId)),
          headers: {
            ...baseHeaders,
            cookie: cookieHeader,
          },
          method: "POST",
        },
      );

      assertHttpStatus(cookieCompletion, 200, "Expected complete-quiz to accept the signed cookie.");
      assertWithContext(
        cookieCompletion.body?.score === 6,
        "Expected the trusted completion score to be recomputed as 6.",
        formatHttpResult(cookieCompletion),
      );
      assertWithContext(
        cookieCompletion.body?.raffleEligible === true,
        "Expected the first completion to earn the raffle entry.",
        formatHttpResult(cookieCompletion),
      );

      logStep("Retrying the same completion via the explicit session header fallback");
      const repeatedCompletion = await invokeCompletionWithRetry(
        "Header fallback completion",
        `${status.FUNCTIONS_URL}/complete-quiz`,
        {
          body: JSON.stringify(buildCompletionPayload(requestId)),
          headers: {
            ...baseHeaders,
            "x-neighborly-session": issueSession.body.sessionToken,
          },
          method: "POST",
        },
      );

      assertHttpStatus(
        repeatedCompletion,
        200,
        "Expected complete-quiz to accept the explicit session header fallback.",
      );
      assertWithContext(
        repeatedCompletion.body?.completionId === cookieCompletion.body?.completionId,
        "Expected the retry path to be idempotent for the same request id.",
        formatHttpResult(repeatedCompletion),
      );
      assertWithContext(
        repeatedCompletion.body?.attemptNumber === 1,
        "Expected the retry path not to increment the attempt number for the same request id.",
        formatHttpResult(repeatedCompletion),
      );
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
