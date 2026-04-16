const { logStep, run } = require("./utils.cjs");

const defaultReadinessTimeoutMs = 180_000;
const defaultReadinessPollMs = 5_000;

function readRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readDurationEnv(name, fallback) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds.`);
  }

  return parsed;
}

async function waitForRouteReady({ routeLabel, routeUrl, timeoutMs, pollMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "No response yet.";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(routeUrl, {
        method: "GET",
        redirect: "manual",
      });

      if (response.status >= 200 && response.status < 500) {
        logStep(`${routeLabel} is reachable (${response.status})`);
        return;
      }

      lastFailure = `Unexpected status ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    `Timed out waiting for ${routeLabel}. Last failure: ${lastFailure}`,
  );
}

async function main() {
  const baseUrl = readRequiredEnv("PRODUCTION_SMOKE_BASE_URL").replace(/\/$/, "");
  const eventSlug = readRequiredEnv("TEST_ADMIN_EVENT_SLUG");

  // Validate all expected smoke inputs up front so failures are actionable.
  readRequiredEnv("TEST_SUPABASE_URL");
  readRequiredEnv("TEST_SUPABASE_SERVICE_ROLE_KEY");
  readRequiredEnv("VITE_SUPABASE_URL");
  readRequiredEnv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  readRequiredEnv("TEST_ADMIN_EMAIL");
  readRequiredEnv("TEST_DENIED_ADMIN_EMAIL");
  readRequiredEnv("TEST_ADMIN_EVENT_ID");
  readRequiredEnv("TEST_ADMIN_EVENT_NAME");

  const timeoutMs = readDurationEnv(
    "PRODUCTION_SMOKE_READY_TIMEOUT_MS",
    defaultReadinessTimeoutMs,
  );
  const pollMs = readDurationEnv(
    "PRODUCTION_SMOKE_READY_POLL_MS",
    defaultReadinessPollMs,
  );

  logStep("Waiting for deployed admin route readiness");
  await waitForRouteReady({
    pollMs,
    routeLabel: "/admin",
    routeUrl: `${baseUrl}/admin`,
    timeoutMs,
  });

  logStep("Waiting for deployed game route readiness");
  await waitForRouteReady({
    pollMs,
    routeLabel: `/game/${eventSlug}`,
    routeUrl: `${baseUrl}/game/${eventSlug}`,
    timeoutMs,
  });

  logStep("Running production admin Playwright smoke suite");
  run("npx", ["playwright", "test", "-c", "playwright.production-admin-smoke.config.ts"]);
}

main().catch((error) => {
  console.error(`\nProduction admin smoke failed.\n${error.message}`);
  process.exit(1);
});
