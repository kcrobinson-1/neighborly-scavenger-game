const { spawn } = require("node:child_process");
const path = require("node:path");

const { fs, repoRoot } = require("./utils.cjs");

const serveShutdownTimeoutMs = 5_000;

function writeFunctionsServeEnvFile(envFilePath, { allowedOrigins, sessionSigningSecret }) {
  fs.mkdirSync(path.dirname(envFilePath), { recursive: true });

  // The local Edge Functions runtime injects the reserved SUPABASE_* values
  // itself, so the env file only needs the repo-owned trust configuration.
  fs.writeFileSync(
    envFilePath,
    [
      `SESSION_SIGNING_SECRET=${sessionSigningSecret}`,
      `ALLOWED_ORIGINS=${allowedOrigins.join(",")}`,
      "",
    ].join("\n"),
  );
}

function startFunctionsServe(envFilePath) {
  const child = spawn(
    "npx",
    ["supabase", "functions", "serve", "--env-file", envFilePath],
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

module.exports = {
  startFunctionsServe,
  stopFunctionsServe,
  writeFunctionsServeEnvFile,
};
