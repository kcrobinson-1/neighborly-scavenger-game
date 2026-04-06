const { spawn } = require("node:child_process");
const path = require("node:path");

const {
  ensureDockerRuntime,
  fs,
  isSupabaseStackRunning,
  logStep,
  readSupabaseStatus,
  resetLocalSupabaseDatabase,
  repoRoot,
  startLocalSupabaseStack,
  stopLocalSupabaseStack,
  tmpRoot,
} = require("./utils.cjs");

const lockPath = `${tmpRoot}/test-functions-integration.lock`;
const serveEnvPath = path.join(tmpRoot, "test-functions.env");
const serveReadyTimeoutMs = 20_000;
const serveShutdownTimeoutMs = 5_000;
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

function startFunctionsServe() {
  const child = spawn(
    "npx",
    ["supabase", "functions", "serve", "--env-file", serveEnvPath],
    {
      cwd: repoRoot,
      detached: process.platform !== "win32",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";

  const appendOutput = (chunk) => {
    output += chunk.toString();
  };

  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);

  return {
    child,
    getOutput() {
      return output.trim();
    },
  };
}

function signalFunctionsServe(serveProcess, signal) {
  if (!serveProcess || serveProcess.exitCode !== null) {
    return;
  }

  try {
    if (process.platform !== "win32" && serveProcess.pid) {
      process.kill(-serveProcess.pid, signal);
      return;
    }
  } catch {
    // Fall back to signaling the direct child process below.
  }

  try {
    serveProcess.kill(signal);
  } catch {
    // Ignore already-exited processes during shutdown cleanup.
  }
}

async function stopFunctionsServe(serveProcess) {
  if (!serveProcess || serveProcess.killed || serveProcess.exitCode !== null) {
    return;
  }

  const closed = new Promise((resolve) => {
    serveProcess.once("close", resolve);
  });

  signalFunctionsServe(serveProcess, "SIGTERM");

  const timedClose = Promise.race([
    closed,
    new Promise((resolve) => setTimeout(resolve, serveShutdownTimeoutMs)),
  ]);

  await timedClose;

  if (serveProcess.exitCode !== null) {
    return;
  }

  signalFunctionsServe(serveProcess, "SIGKILL");
  serveProcess.stdout?.destroy();
  serveProcess.stderr?.destroy();

  await Promise.race([
    closed,
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
}

async function invokeJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return {
    body,
    response,
  };
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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
    const serveRuntime = startFunctionsServe();

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

      assert(setCookieHeader, "Expected issue-session to return Set-Cookie.");

      const cookieHeader = setCookieHeader.split(";")[0];

      logStep("Completing the quiz with the cookie transport");
      const cookieCompletion = await invokeJson(`${status.FUNCTIONS_URL}/complete-quiz`, {
        body: JSON.stringify(buildCompletionPayload(requestId)),
        headers: {
          ...baseHeaders,
          cookie: cookieHeader,
        },
        method: "POST",
      });

      assert(cookieCompletion.response.status === 200, "Expected complete-quiz to accept the signed cookie.");
      assert(cookieCompletion.body?.score === 6, "Expected the trusted completion score to be recomputed as 6.");
      assert(cookieCompletion.body?.raffleEligible === true, "Expected the first completion to earn the raffle entry.");

      logStep("Retrying the same completion via the explicit session header fallback");
      const repeatedCompletion = await invokeJson(`${status.FUNCTIONS_URL}/complete-quiz`, {
        body: JSON.stringify(buildCompletionPayload(requestId)),
        headers: {
          ...baseHeaders,
          "x-neighborly-session": issueSession.body.sessionToken,
        },
        method: "POST",
      });

      assert(repeatedCompletion.response.status === 200, "Expected complete-quiz to accept the explicit session header fallback.");
      assert(
        repeatedCompletion.body?.completionId === cookieCompletion.body?.completionId,
        "Expected the retry path to be idempotent for the same request id.",
      );
      assert(
        repeatedCompletion.body?.attemptNumber === 1,
        "Expected the retry path not to increment the attempt number for the same request id.",
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
