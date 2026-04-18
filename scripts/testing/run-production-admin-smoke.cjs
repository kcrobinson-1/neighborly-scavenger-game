const { logStep, run } = require("./utils.cjs");

const defaultReadinessTimeoutMs = 180_000;
const defaultReadinessPollMs = 5_000;
const defaultSmokeFixture = {
  adminEmail: "production-smoke-admin@example.com",
  deniedAdminEmail: "production-smoke-denied@example.com",
  eventId: "production-smoke-event",
  eventName: "Production Smoke Event",
  eventSlug: "production-smoke-event",
};

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

      // Treat only served/redirected app routes as ready; transient 404s are
      // common during deployment propagation and should keep polling.
      if (response.status >= 200 && response.status < 400) {
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
  const eventSlug =
    process.env.TEST_ADMIN_EVENT_SLUG || defaultSmokeFixture.eventSlug;

  process.env.TEST_ADMIN_EMAIL ||= defaultSmokeFixture.adminEmail;
  process.env.TEST_DENIED_ADMIN_EMAIL ||= defaultSmokeFixture.deniedAdminEmail;
  process.env.TEST_ADMIN_EVENT_ID ||= defaultSmokeFixture.eventId;
  process.env.TEST_ADMIN_EVENT_NAME ||= defaultSmokeFixture.eventName;
  process.env.TEST_ADMIN_EVENT_SLUG ||= defaultSmokeFixture.eventSlug;

  // Validate required deployment and Supabase inputs up front so failures are actionable.
  readRequiredEnv("TEST_SUPABASE_URL");
  readRequiredEnv("TEST_SUPABASE_SERVICE_ROLE_KEY");
  readRequiredEnv("VITE_SUPABASE_URL");
  readRequiredEnv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY");

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
    routeLabel: `/event/${eventSlug}/game`,
    routeUrl: `${baseUrl}/event/${eventSlug}/game`,
    timeoutMs,
  });

  logStep("Running production admin Playwright smoke suite");
  run("npx", ["playwright", "test", "-c", "playwright.production-admin-smoke.config.ts"]);
}

main().catch((error) => {
  console.error(`\nProduction admin smoke failed.\n${error.message}`);
  process.exit(1);
});
