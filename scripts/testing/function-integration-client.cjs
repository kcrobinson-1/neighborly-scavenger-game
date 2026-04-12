const {
  assertHttpStatus,
  formatHttpResult,
  invokeJson,
} = require("./http-json.cjs");

const readyPollIntervalMs = 250;
const completionRetryDelayBaseMs = 500;

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

function assertWithContext(condition, message, context) {
  if (!condition) {
    throw new Error(`${message}\n${context}`);
  }
}

function assertServeIsRunning(serveRuntime, message) {
  if (serveRuntime.child.exitCode !== null) {
    throw new Error(
      [
        message,
        "If another functions runtime is already bound to the local Supabase ports, stop it and rerun this command.",
        serveRuntime.getOutput(),
      ].filter(Boolean).join("\n\n"),
    );
  }
}

function shouldRetryCompletion(result) {
  return [500, 502, 503, 504].includes(result.response.status);
}

function createFunctionIntegrationClient({
  allowedOrigin,
  completionAttemptCount,
  logStep,
  readyTimeoutMs,
  serveRuntime,
  status,
}) {
  const baseHeaders = {
    Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    apikey: status.PUBLISHABLE_KEY,
    origin: allowedOrigin,
  };

  const functionUrl = (name) => `${status.FUNCTIONS_URL}/${name}`;

  async function waitForIssueSessionReady() {
    const deadline = Date.now() + readyTimeoutMs;
    let lastFailureDetails = "";

    while (Date.now() < deadline) {
      assertServeIsRunning(
        serveRuntime,
        "`supabase functions serve` exited before the local integration test became ready.",
      );

      try {
        const issueSession = await invokeJson(functionUrl("issue-session"), {
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

        lastFailureDetails = formatHttpResult(issueSession);
      } catch (error) {
        lastFailureDetails = error instanceof Error ? error.message : String(error);
      }

      await new Promise((resolve) => setTimeout(resolve, readyPollIntervalMs));
    }

    throw new Error(
      [
        "Timed out waiting for `supabase functions serve` to return a ready issue-session response.",
        lastFailureDetails,
        serveRuntime.getOutput(),
      ].filter(Boolean).join("\n\n"),
    );
  }

  async function waitForCompleteQuizReady() {
    const deadline = Date.now() + readyTimeoutMs;
    let lastFailureDetails = "";

    while (Date.now() < deadline) {
      assertServeIsRunning(
        serveRuntime,
        "`supabase functions serve` exited before complete-quiz became ready.",
      );

      try {
        const completeQuiz = await invokeJson(functionUrl("complete-quiz"), {
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

      await new Promise((resolve) => setTimeout(resolve, readyPollIntervalMs));
    }

    throw new Error(
      [
        "Timed out waiting for `supabase functions serve` to return a ready complete-quiz response.",
        lastFailureDetails,
        serveRuntime.getOutput(),
      ].filter(Boolean).join("\n\n"),
    );
  }

  function extractSessionCookie(issueSession) {
    const setCookieHeader = issueSession.response.headers.get("set-cookie");

    assertWithContext(
      setCookieHeader,
      "Expected issue-session to return Set-Cookie.",
      formatHttpResult(issueSession),
    );

    return setCookieHeader.split(";")[0];
  }

  async function invokeCompletionWithRetry(label, init) {
    let lastResult = null;
    let lastError = null;

    for (let attempt = 1; attempt <= completionAttemptCount; attempt += 1) {
      try {
        lastResult = await invokeJson(functionUrl("complete-quiz"), init);
        lastError = null;
      } catch (error) {
        lastError = error;

        if (attempt === completionAttemptCount) {
          break;
        }

        logStep(
          `${label} request failed; retrying after local Edge Function warmup (${attempt}/${completionAttemptCount})`,
        );
        await new Promise((resolve) => setTimeout(resolve, completionRetryDelayBaseMs * attempt));
        continue;
      }

      if (!shouldRetryCompletion(lastResult) || attempt === completionAttemptCount) {
        return lastResult;
      }

      logStep(
        `${label} returned ${lastResult.response.status}; retrying after local Edge Function warmup (${attempt}/${completionAttemptCount})`,
      );
      await new Promise((resolve) => setTimeout(resolve, completionRetryDelayBaseMs * attempt));
    }

    if (lastResult) {
      return lastResult;
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`${label} request failed after ${completionAttemptCount} attempts.\n${errorMessage}`);
  }

  async function completeQuizWithCookie(cookieHeader, payload) {
    return await invokeCompletionWithRetry("Cookie completion", {
      body: JSON.stringify(payload),
      headers: {
        ...baseHeaders,
        cookie: cookieHeader,
      },
      method: "POST",
    });
  }

  async function completeQuizWithSessionHeader(sessionToken, payload) {
    return await invokeCompletionWithRetry("Header fallback completion", {
      body: JSON.stringify(payload),
      headers: {
        ...baseHeaders,
        "x-neighborly-session": sessionToken,
      },
      method: "POST",
    });
  }

  function assertTrustedCookieCompletion(cookieCompletion) {
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
  }

  function assertHeaderFallbackRetry(repeatedCompletion, cookieCompletion) {
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
  }

  return {
    assertHeaderFallbackRetry,
    assertTrustedCookieCompletion,
    completeQuizWithCookie,
    completeQuizWithSessionHeader,
    extractSessionCookie,
    waitForCompleteQuizReady,
    waitForIssueSessionReady,
  };
}

module.exports = {
  buildCompletionPayload,
  createFunctionIntegrationClient,
};
