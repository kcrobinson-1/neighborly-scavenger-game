const {
  ensureDockerRuntime,
  fs,
  isSupabaseStackRunning,
  logStep,
  run,
  tmpRoot,
} = require("./utils.cjs");

const lockPath = `${tmpRoot}/test-db.lock`;

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
        "Another database test run is already in progress. Wait for it to finish before starting a second `npm run test:db` or `npm run validate:local`.",
      );
    }

    throw error;
  }
}

function startLocalStackWithRetry() {
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

function main() {
  let startedLocalStack = false;
  const releaseLock = acquireLock();

  try {
    // The database suite is only meaningful against a real local Supabase stack,
    // so we make the runtime dependency explicit and self-serve here.
    logStep("Checking Docker runtime for local Supabase");
    ensureDockerRuntime();

    if (isSupabaseStackRunning()) {
      logStep("Reusing existing local Supabase stack");
    } else {
      startedLocalStack = startLocalStackWithRetry();
    }

    logStep("Running pgTAP database tests");
    run("npx", ["supabase", "test", "db"]);
  } finally {
    if (startedLocalStack) {
      logStep("Stopping local Supabase stack");
      run("npx", ["supabase", "stop"], {
        check: false,
      });
    }

    releaseLock();
  }
}

try {
  main();
} catch (error) {
  console.error(`\nLocal database test setup failed.\n${error.message}`);
  process.exit(1);
}
