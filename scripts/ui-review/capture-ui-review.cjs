const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const defaultBaseUrl = "http://127.0.0.1:4173";
const defaultOutputRoot = path.join("tmp", "ui-review");

/** Parses simple `--key value` style arguments for the capture workflow. */
function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

/** Builds a stable timestamp for a fresh screenshot run directory. */
function createTimestamp() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];

  return parts.join("");
}

/**
 * Resolves the output directory for this run.
 * By default each run gets a fresh timestamped folder under `tmp/ui-review`.
 */
function resolveRunDirectory(outputDir) {
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    return outputDir;
  }

  const runDirectory = path.join(defaultOutputRoot, createTimestamp());
  fs.mkdirSync(runDirectory, { recursive: true });
  return runDirectory;
}

/** Uses DOM-level click activation because the mobile card layout can confuse Playwright actionability checks. */
async function activate(locator) {
  await locator.evaluate((element) => element.click());
}

/** Selects an answer and submits the current question. */
async function clickOptionAndSubmit(page, optionLabel, submitLabel = "Submit answer") {
  await activate(page.getByLabel(optionLabel, { exact: true }));
  await activate(page.getByRole("button", { name: submitLabel, exact: true }));
}

/** Navigates to the landing page and waits for the app to settle. */
async function openHome(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
}

/** Saves a full-page screenshot into the current run directory. */
async function capture(page, runDirectory, fileName) {
  await page.screenshot({
    path: path.join(runDirectory, fileName),
    fullPage: true,
  });
}

/** Verifies that direct navigation to the featured route works before deeper flow checks. */
async function verifyDirectRoute(page, baseUrl) {
  await page.goto(`${baseUrl}/game/first-sample`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Madrona Music in the Playfield" }).waitFor();
}

/** Captures the landing page in both mobile and desktop layouts. */
async function captureLandingStates(baseUrl, runDirectory) {
  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({
    ...devices["iPhone 13"],
  });
  const mobilePage = await mobileContext.newPage();

  await openHome(mobilePage, baseUrl);
  await capture(mobilePage, runDirectory, "01-landing-mobile.png");
  await mobileBrowser.close();

  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopPage = await desktopBrowser.newPage({
    viewport: { width: 1440, height: 1200 },
  });

  await desktopPage.goto(baseUrl, { waitUntil: "networkidle" });
  await capture(desktopPage, runDirectory, "02-landing-desktop.png");
  await desktopBrowser.close();
}

/** Captures the primary featured sample flow, including back navigation and completion. */
async function captureFeaturedFlow(page, baseUrl, runDirectory) {
  await openHome(page, baseUrl);
  await activate(page.getByRole("button", { name: "Try the attendee demo", exact: true }));
  await page.waitForURL(`${baseUrl}/game/first-sample`);
  await page.getByRole("heading", { name: "Madrona Music in the Playfield" }).waitFor();
  await capture(page, runDirectory, "03-featured-intro.png");

  await activate(page.getByRole("button", { name: "Start quiz", exact: true }));
  await page.getByRole("heading", {
    name: "Which local spot is sponsoring this neighborhood music series question?",
  }).waitFor();
  await capture(page, runDirectory, "04-featured-question-1.png");

  await clickOptionAndSubmit(page, "Hi Spot Cafe");
  await page.getByRole("heading", {
    name: "What kind of experience should this game feel like?",
  }).waitFor();

  await clickOptionAndSubmit(page, "A quick neighborhood game");
  await page.getByRole("heading", {
    name: "How many questions should the MVP generally ask attendees?",
  }).waitFor();

  await clickOptionAndSubmit(page, "5 to 7");
  await page.getByRole("heading", {
    name: "What matters most for raffle eligibility in the MVP?",
  }).waitFor();

  await clickOptionAndSubmit(page, "Finishing the quiz");
  await page.getByRole("heading", {
    name: "How should questions appear in the experience?",
  }).waitFor();

  await activate(page.getByRole("button", { name: "Back to the previous question", exact: true }));
  await page.getByRole("heading", {
    name: "What matters most for raffle eligibility in the MVP?",
  }).waitFor();
  await capture(page, runDirectory, "05-featured-back-navigation.png");

  await clickOptionAndSubmit(page, "Finishing the quiz");
  await page.getByRole("heading", {
    name: "How should questions appear in the experience?",
  }).waitFor();

  await clickOptionAndSubmit(page, "One card at a time");
  await page.getByRole("heading", {
    name: "What should the final screen make obvious?",
  }).waitFor();

  await clickOptionAndSubmit(page, "That the attendee is officially done");
  await page.getByRole("heading", { name: "Show this screen at the raffle table" }).waitFor();
  await capture(page, runDirectory, "06-featured-completion.png");
}

/** Captures the incorrect and correct feedback states in the spotlight mode. */
async function captureSpotlightFlow(page, baseUrl, runDirectory) {
  await openHome(page, baseUrl);
  await activate(page.getByRole("button", { name: "Try this demo", exact: true }).nth(0));
  await page.waitForURL(`${baseUrl}/game/sponsor-spotlight`);
  await page.getByRole("heading", { name: "Sponsor Spotlight Challenge" }).waitFor();
  await activate(page.getByRole("button", { name: "Start quiz", exact: true }));
  await page.getByRole("heading", {
    name: "Which answer best describes why sponsors appear inside the quiz experience?",
  }).waitFor();

  await clickOptionAndSubmit(page, "To interrupt players with ads");
  await page.getByRole("status").getByText("Try again.", { exact: true }).waitFor();
  await capture(page, runDirectory, "07-spotlight-incorrect.png");

  await clickOptionAndSubmit(page, "To feel integrated into the neighborhood event");
  await page.getByRole("heading", { name: "Bottlehouse" }).waitFor();
  await capture(page, runDirectory, "08-spotlight-correct-feedback.png");
}

/** Captures the multiple-selection state in the checklist sample. */
async function captureCommunityChecklist(page, baseUrl, runDirectory) {
  await openHome(page, baseUrl);
  await activate(page.getByRole("button", { name: "Try this demo", exact: true }).nth(1));
  await page.waitForURL(`${baseUrl}/game/community-checklist`);
  await page.getByRole("heading", { name: "Community Checklist Quiz" }).waitFor();
  await activate(page.getByRole("button", { name: "Start quiz", exact: true }));
  await page.getByRole("heading", {
    name: "Which behaviors support a strong neighborhood-event quiz experience?",
  }).waitFor();

  await activate(page.getByLabel("Large tap targets", { exact: true }));
  await activate(page.getByLabel("Visible progress", { exact: true }));
  await capture(page, runDirectory, "09-community-multi-select.png");
}

/** Captures unsupported routes and missing-game fallbacks. */
async function captureNotFoundStates(page, baseUrl, runDirectory) {
  await page.goto(`${baseUrl}/not-a-route`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "That page isn't available in this demo." }).waitFor();
  await capture(page, runDirectory, "10-not-found-route.png");

  await page.goto(`${baseUrl}/game/not-a-real-sample`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "This quiz isn't available right now." }).waitFor();
  await capture(page, runDirectory, "11-unavailable-game-route.png");
}

/** Captures the route-level load error when pointed at a misconfigured local app. */
async function captureRouteLoadError(errorBaseUrl, runDirectory) {
  if (!errorBaseUrl) {
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
  });
  const page = await context.newPage();

  await page.goto(`${errorBaseUrl}/game/first-sample`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "This quiz couldn't load right now." }).waitFor();
  await capture(page, runDirectory, "12-route-load-error.png");

  await browser.close();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options["base-url"] ?? process.env.UI_REVIEW_BASE_URL ?? defaultBaseUrl;
  const errorBaseUrl = options["error-base-url"] ?? process.env.UI_REVIEW_ERROR_BASE_URL;
  const runDirectory = resolveRunDirectory(options["output-dir"]);

  await captureLandingStates(baseUrl, runDirectory);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
  });
  const page = await context.newPage();

  await verifyDirectRoute(page, baseUrl);
  await captureFeaturedFlow(page, baseUrl, runDirectory);
  await captureSpotlightFlow(page, baseUrl, runDirectory);
  await captureCommunityChecklist(page, baseUrl, runDirectory);
  await captureNotFoundStates(page, baseUrl, runDirectory);

  await browser.close();
  await captureRouteLoadError(errorBaseUrl, runDirectory);

  console.log(`UI review artifacts written to ${runDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
