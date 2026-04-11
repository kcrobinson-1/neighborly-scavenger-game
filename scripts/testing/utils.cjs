const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const tmpRoot = path.join(repoRoot, "tmp");

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, options = {}) {
  const {
    capture = false,
    check = true,
    env,
  } = options;

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw new Error(`Failed to run \`${formatCommand(command, args)}\`: ${result.error.message}`);
  }

  if (check && result.status !== 0) {
    const stderr = capture ? `\n${result.stderr ?? ""}` : "";
    throw new Error(`Command failed: \`${formatCommand(command, args)}\`${stderr}`.trim());
  }

  return result;
}

function logStep(message) {
  console.log(`\n[local-tests] ${message}`);
}

function ensureCommandAvailable(command, versionArgs, missingMessage) {
  const result = spawnSync(command, versionArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "ignore",
  });

  if (result.error) {
    throw new Error(missingMessage);
  }
}

function ensureDenoAvailable() {
  ensureCommandAvailable(
    "deno",
    ["--version"],
    "Deno is not installed. Install Deno so the Edge Function checks can run locally.",
  );
}

function ensureDockerRuntime() {
  ensureCommandAvailable(
    "docker",
    ["--version"],
    "A Docker API-compatible runtime is required for local Supabase tests. Install and run Docker Desktop, OrbStack, Rancher Desktop, or Podman before running `npm run test:db`.",
  );

  const dockerInfo = run("docker", ["info"], {
    capture: true,
    check: false,
  });

  if (dockerInfo.status !== 0) {
    throw new Error(
      "Docker is installed but the daemon is not available. Start your local Docker runtime before running Supabase database tests.",
    );
  }
}

function hasPlaywrightChromium() {
  const result = run("npx", ["playwright", "install", "--list"], {
    capture: true,
    check: false,
  });

  return result.status === 0 && /chromium-\d+/.test(result.stdout ?? "");
}

function parseSupabaseStatusOutput(output) {
  const trimmedOutput = output?.trim() ?? "";

  if (!trimmedOutput) {
    return null;
  }

  const match = trimmedOutput.match(/\{[\s\S]*\}$/);

  if (!match) {
    throw new Error("Supabase status output did not include the expected JSON payload.");
  }

  return normalizeSupabaseStatus(JSON.parse(match[0]));
}

function normalizeSupabaseStatus(status) {
  if (!status || typeof status !== "object") {
    return status;
  }

  if (!status.FUNCTIONS_URL && typeof status.API_URL === "string") {
    return {
      ...status,
      FUNCTIONS_URL: `${status.API_URL.replace(/\/$/, "")}/functions/v1`,
    };
  }

  return status;
}

function readSupabaseStatus() {
  const result = run("npx", ["supabase", "status", "-o", "json"], {
    capture: true,
    check: false,
  });

  if (result.status !== 0) {
    return null;
  }

  return parseSupabaseStatusOutput(result.stdout);
}

function isSupabaseStackRunning() {
  return readSupabaseStatus() !== null;
}

function startLocalSupabaseStack() {
  try {
    logStep("Starting local Supabase stack");
    run("npx", ["supabase", "start"]);
    return true;
  } catch {
    logStep("Cleaning up a partial local Supabase stack before retry");
    run("npx", ["supabase", "stop"], { check: false });

    logStep("Retrying local Supabase startup");
    run("npx", ["supabase", "start"]);
    return true;
  }
}

function resetLocalSupabaseDatabase() {
  logStep("Resetting local Supabase database to current migrations");
  run("npx", ["supabase", "db", "reset", "--local", "--no-seed", "--yes"]);
}

function stopLocalSupabaseStack() {
  logStep("Stopping local Supabase stack");
  run("npx", ["supabase", "stop"], {
    check: false,
  });
}

module.exports = {
  ensureCommandAvailable,
  ensureDenoAvailable,
  ensureDockerRuntime,
  formatCommand,
  fs,
  hasPlaywrightChromium,
  isSupabaseStackRunning,
  parseSupabaseStatusOutput,
  readSupabaseStatus,
  resetLocalSupabaseDatabase,
  logStep,
  repoRoot,
  run,
  startLocalSupabaseStack,
  stopLocalSupabaseStack,
  tmpRoot,
};
