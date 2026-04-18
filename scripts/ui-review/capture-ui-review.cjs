const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const defaultBaseUrl = "http://127.0.0.1:4173";
const defaultOutputRoot = path.join("tmp", "ui-review");
const adminEnvPath = path.join("apps", "web", ".env");

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

/** Parses a small Vite-style .env file into a string map. */
function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const entries = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex < 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

/** Resolves the Supabase URL used by the admin capture workflow. */
function getAdminCaptureSupabaseUrl() {
  return (
    process.env.VITE_SUPABASE_URL ||
    readEnvFile(adminEnvPath).VITE_SUPABASE_URL ||
    ""
  );
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
  await page.goto(`${baseUrl}/event/first-sample/game`, { waitUntil: "networkidle" });
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
  await page.waitForURL(`${baseUrl}/event/first-sample/game`);
  await page.getByRole("heading", { name: "Madrona Music in the Playfield" }).waitFor();
  await capture(page, runDirectory, "03-featured-intro.png");

  await activate(page.getByRole("button", { name: "Start game", exact: true }));
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
    name: "What matters most for reward eligibility in the MVP?",
  }).waitFor();

  await clickOptionAndSubmit(page, "Finishing the game");
  await page.getByRole("heading", {
    name: "How should questions appear in the experience?",
  }).waitFor();

  await activate(page.getByRole("button", { name: "Back to the previous question", exact: true }));
  await page.getByRole("heading", {
    name: "What matters most for reward eligibility in the MVP?",
  }).waitFor();
  await capture(page, runDirectory, "05-featured-back-navigation.png");

  await clickOptionAndSubmit(page, "Finishing the game");
  await page.getByRole("heading", {
    name: "How should questions appear in the experience?",
  }).waitFor();

  await clickOptionAndSubmit(page, "One card at a time");
  await page.getByRole("heading", {
    name: "What should the final screen make obvious?",
  }).waitFor();

  await clickOptionAndSubmit(page, "That the attendee is officially done");
  await page.getByRole("heading", { name: "Show this screen at the volunteer table" }).waitFor();
  await capture(page, runDirectory, "06-featured-completion.png");
}

/** Captures the incorrect and correct feedback states in the spotlight mode. */
async function captureSpotlightFlow(page, baseUrl, runDirectory) {
  await openHome(page, baseUrl);
  await activate(
    page
      .locator(".sample-game-row")
      .filter({ hasText: "Sponsor Spotlight Challenge" })
      .getByRole("button", { name: "Try this demo", exact: true }),
  );
  await page.waitForURL(`${baseUrl}/event/sponsor-spotlight/game`);
  await page.getByRole("heading", { name: "Sponsor Spotlight Challenge" }).waitFor();
  await activate(page.getByRole("button", { name: "Start game", exact: true }));
  await page.getByRole("heading", {
    name: "Which answer best describes why sponsors appear inside the game experience?",
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
  await activate(
    page
      .locator(".sample-game-row")
      .filter({ hasText: "Community Checklist Game" })
      .getByRole("button", { name: "Try this demo", exact: true }),
  );
  await page.waitForURL(`${baseUrl}/event/community-checklist/game`);
  await page.getByRole("heading", { name: "Community Checklist Game" }).waitFor();
  await activate(page.getByRole("button", { name: "Start game", exact: true }));
  await page.getByRole("heading", {
    name: "Which behaviors support a strong neighborhood-event game experience?",
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

  await page.goto(`${baseUrl}/event/not-a-real-sample/game`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "This game isn't available right now." }).waitFor();
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

  await page.goto(`${errorBaseUrl}/event/first-sample/game`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "This game couldn't load right now." }).waitFor();
  await capture(page, runDirectory, "12-route-load-error.png");

  await browser.close();
}

// ---------------------------------------------------------------------------
// Admin capture mode — fixture constants
// ---------------------------------------------------------------------------

const ADMIN_MOCK_SESSION = {
  access_token: "mock-admin-access-token",
  refresh_token: "mock-admin-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.com",
    email_confirmed_at: "2024-01-01T00:00:00.000Z",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  },
};

function getSupabaseAuthStorageKey(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

async function installMockAdminSession(page, supabaseUrl) {
  await page.addInitScript(
    ({ session, storageKey }) => {
      globalThis.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      session: ADMIN_MOCK_SESSION,
      storageKey: getSupabaseAuthStorageKey(supabaseUrl),
    },
  );
}

const ADMIN_DRAFT_SUMMARY_FIXTURE = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    live_version_number: 3,
    name: "Madrona Summer Block Party",
    slug: "madrona-summer",
    updated_at: "2025-03-10T14:22:00.000Z",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    live_version_number: null,
    name: "Greenwood Arts Walk Draft",
    slug: "greenwood-arts-draft",
    updated_at: "2025-03-08T09:05:00.000Z",
  },
];

const ADMIN_DRAFT_DETAIL_FIXTURE = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    live_version_number: 3,
    name: "Madrona Summer Block Party",
    slug: "madrona-summer",
    updated_at: "2025-03-10T14:22:00.000Z",
    created_at: "2025-01-15T08:00:00.000Z",
    last_saved_by: "admin@example.com",
    content: {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      slug: "madrona-summer",
      name: "Madrona Summer Block Party",
      location: "Madrona Playfield, Seattle WA",
      estimatedMinutes: 5,
      entitlementLabel: "Show this at the volunteer table",
      intro: "Welcome to the Madrona Summer Block Party game!",
      summary: "Thanks for playing. Visit the volunteer table for reward check-in.",
      feedbackMode: "final_score_reveal",
      allowBackNavigation: true,
      allowRetake: true,
      questions: [
        {
          id: "q-0000-0001",
          sponsor: "Hi Spot Cafe",
          prompt: "Which local cafe is sponsoring this year's block party?",
          selectionMode: "single",
          correctAnswerIds: ["opt-0001-a"],
          explanation: "Hi Spot Cafe has been a Madrona neighborhood staple for years.",
          options: [
            { id: "opt-0001-a", label: "Hi Spot Cafe" },
            { id: "opt-0001-b", label: "Bottlehouse" },
            { id: "opt-0001-c", label: "Madrona Ale House" },
            { id: "opt-0001-d", label: "Cafe Soleil" },
          ],
        },
        {
          id: "q-0000-0002",
          sponsor: "Madrona Dance Studio",
          prompt: "What is the main activity planned for the north lawn?",
          selectionMode: "single",
          correctAnswerIds: ["opt-0002-b"],
          explanation: "Live music and open dancing kicks off at noon.",
          sponsorFact: "Madrona Dance Studio teaches salsa, swing, and contemporary styles.",
          options: [
            { id: "opt-0002-a", label: "Yoga session" },
            { id: "opt-0002-b", label: "Live music and open dancing" },
            { id: "opt-0002-c", label: "Pie-eating contest" },
            { id: "opt-0002-d", label: "Kids obstacle course" },
          ],
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Admin capture mode — mock installer factory
// ---------------------------------------------------------------------------

/**
 * Builds an installMocks function that registers page.route() interceptors for
 * all Supabase endpoints the admin app calls during its authenticated flow.
 *
 * @param {string} supabaseUrl - The real VITE_SUPABASE_URL value (read at runtime)
 * @param {object} [overrides]
 * @param {boolean} [overrides.isAdmin=true] - Whether is_admin returns true
 * @param {object|null} [overrides.saveDraftResponse] - Override for save-draft response
 * @param {number} [overrides.saveDraftStatus] - Override HTTP status for save-draft
 */
function buildAdminMocks(supabaseUrl, overrides = {}) {
  const {
    isAdmin = true,
    saveDraftResponse = null,
    saveDraftStatus = 200,
  } = overrides;

  /**
   * Installs all admin Supabase route mocks on the given page.
   * @param {import("playwright").Page} page
   */
  async function installMocks(page) {
    await installMockAdminSession(page, supabaseUrl);

    // Auth session restore (GET)
    await page.route(`${supabaseUrl}/auth/v1/session`, (route) => {
      if (route.request().method() === "GET") {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ADMIN_MOCK_SESSION),
        });
      } else {
        void route.continue();
      }
    });

    // Auth token exchange (POST) — used by signInWithOtp redirect
    await page.route(`${supabaseUrl}/auth/v1/token*`, (route) => {
      if (route.request().method() === "POST") {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ADMIN_MOCK_SESSION),
        });
      } else {
        void route.continue();
      }
    });

    // is_admin RPC (POST)
    await page.route(`${supabaseUrl}/rest/v1/rpc/is_admin`, (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isAdmin),
      });
    });

    // game_event_drafts table reads (GET)
    // Detail reads include content,created_at,last_saved_by in the select param.
    // Summary reads include only id,live_version_number,name,slug,updated_at.
    await page.route(`${supabaseUrl}/rest/v1/game_event_drafts*`, (route) => {
      if (route.request().method() !== "GET") {
        void route.continue();
        return;
      }

      const url = route.request().url();
      const isDetailRead = url.includes("content") || url.includes("last_saved_by") || url.includes("created_at");

      if (isDetailRead) {
        // maybeSingle — Supabase returns the row directly when Accept: application/vnd.pgrst.object+json
        // or as an array otherwise. The client uses .maybeSingle() so the JS client sets the Accept header.
        const acceptHeader = route.request().headers()["accept"] ?? "";
        const returnSingle = acceptHeader.includes("vnd.pgrst.object");

        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(returnSingle ? ADMIN_DRAFT_DETAIL_FIXTURE[0] : ADMIN_DRAFT_DETAIL_FIXTURE),
        });
      } else {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ADMIN_DRAFT_SUMMARY_FIXTURE),
        });
      }
    });

    // save-draft Edge Function (POST)
    const defaultSaveResponse = {
      hasBeenPublished: true,
      id: ADMIN_DRAFT_DETAIL_FIXTURE[0].id,
      liveVersionNumber: ADMIN_DRAFT_DETAIL_FIXTURE[0].live_version_number,
      name: ADMIN_DRAFT_DETAIL_FIXTURE[0].name,
      slug: ADMIN_DRAFT_DETAIL_FIXTURE[0].slug,
      updatedAt: new Date().toISOString(),
    };

    await page.route("**/functions/v1/save-draft", (route) => {
      if (saveDraftStatus !== 200) {
        void route.fulfill({
          status: saveDraftStatus,
          contentType: "application/json",
          body: JSON.stringify(saveDraftResponse ?? { error: "Simulated backend error." }),
        });
      } else {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(saveDraftResponse ?? defaultSaveResponse),
        });
      }
    });
  }

  return installMocks;
}

// ---------------------------------------------------------------------------
// Admin capture mode — capture functions
// ---------------------------------------------------------------------------

/**
 * Captures the admin sign-in form without mocks (signed-out state).
 * Screenshots 01 (iPhone 13) and 02 (desktop 1440px).
 */
async function captureAdminSignInStates(baseUrl, runDirectory) {
  console.log("Capturing admin sign-in states...");

  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({ ...devices["iPhone 13"] });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await mobilePage.getByRole("heading", { name: "Send a sign-in link to an admin email." }).waitFor({ timeout: 10000 });
  await capture(mobilePage, runDirectory, "01-admin-sign-in-mobile.png");
  console.log("  01-admin-sign-in-mobile.png");
  await mobileBrowser.close();

  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopPage = await desktopBrowser.newPage({ viewport: { width: 1440, height: 1200 } });

  await desktopPage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await desktopPage.getByRole("heading", { name: "Send a sign-in link to an admin email." }).waitFor({ timeout: 10000 });
  await capture(desktopPage, runDirectory, "02-admin-sign-in-desktop.png");
  console.log("  02-admin-sign-in-desktop.png");
  await desktopBrowser.close();
}

/**
 * Captures the authenticated all-events list view.
 * Screenshots 03 (iPhone 13) and 04 (desktop 1440px).
 */
async function captureAdminAllEventsStates(baseUrl, runDirectory, installMocks) {
  console.log("Capturing admin all-events list states...");

  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({ ...devices["iPhone 13"] });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = [];

  mobilePage.on("console", (msg) => {
    if (msg.type() === "error") mobileErrors.push(msg.text());
  });

  await installMocks(mobilePage);
  await mobilePage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await mobilePage.getByRole("heading", { name: "Event workspace" }).waitFor({ timeout: 10000 });
  await capture(mobilePage, runDirectory, "03-admin-all-events-mobile.png");
  console.log("  03-admin-all-events-mobile.png");
  if (mobileErrors.length > 0) {
    console.warn("  [admin mobile console errors]", mobileErrors);
  }
  await mobileBrowser.close();

  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopPage = await desktopBrowser.newPage({ viewport: { width: 1440, height: 1200 } });
  const desktopErrors = [];

  desktopPage.on("console", (msg) => {
    if (msg.type() === "error") desktopErrors.push(msg.text());
  });

  await installMocks(desktopPage);
  await desktopPage.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await desktopPage.getByRole("heading", { name: "Event workspace" }).waitFor({ timeout: 10000 });
  await capture(desktopPage, runDirectory, "04-admin-all-events-desktop.png");
  console.log("  04-admin-all-events-desktop.png");
  if (desktopErrors.length > 0) {
    console.warn("  [admin desktop console errors]", desktopErrors);
  }
  await desktopBrowser.close();
}

/**
 * Captures the selected event workspace, including the editor, validation
 * error, save success, and backend save error states.
 * Screenshots 05 (mobile editor), 06 (desktop editor), 07 (validation error),
 * 08 (save success), 09 (backend save error).
 *
 * The event workspace URL is /admin/events/:eventId
 */
async function captureAdminWorkspaceStates(baseUrl, runDirectory, installMocks) {
  console.log("Capturing admin workspace states...");

  const eventId = ADMIN_DRAFT_DETAIL_FIXTURE[0].id;
  const workspaceUrl = `${baseUrl}/admin/events/${encodeURIComponent(eventId)}`;

  // 05 — mobile workspace (selected event editor)
  {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installMocks(page);
    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    // Wait for the event details form to appear (indicates authenticated + detail loaded)
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });
    await capture(page, runDirectory, "05-admin-workspace-editor-mobile.png");
    console.log("  05-admin-workspace-editor-mobile.png");
    if (consoleErrors.length > 0) {
      console.warn("  [workspace mobile console errors]", consoleErrors);
    }
    await browser.close();
  }

  // 06 — desktop workspace
  {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installMocks(page);
    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });
    await capture(page, runDirectory, "06-admin-workspace-editor-desktop.png");
    console.log("  06-admin-workspace-editor-desktop.png");
    if (consoleErrors.length > 0) {
      console.warn("  [workspace desktop console errors]", consoleErrors);
    }
    await browser.close();
  }

  // 07 — validation error: clear the event name field and attempt save
  {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installMocks(page);
    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });

    // Clear the event name field — the form label is "Event name"
    // The input is inside a <label> with the text "Event name" and has no name attribute,
    // but we can target it via the admin-details-grid structure.
    const nameInput = page.locator('.admin-details-form .admin-details-grid .admin-input').first();
    await nameInput.fill("");
    // Submit the form (Save changes button)
    await page.getByRole("button", { name: "Save changes" }).click();
    // Wait for the error message to appear
    await page.locator(".admin-message-error").waitFor({ timeout: 5000 });
    await capture(page, runDirectory, "07-admin-workspace-validation-error.png");
    console.log("  07-admin-workspace-validation-error.png");
    if (consoleErrors.length > 0) {
      console.warn("  [workspace validation console errors]", consoleErrors);
    }
    await browser.close();
  }

  // 08 — save success: edit the name and trigger a successful save
  {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installMocks(page);
    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });

    // Make a small edit so Save changes becomes enabled
    const nameInput = page.locator('.admin-details-form .admin-details-grid .admin-input').first();
    await nameInput.fill("Madrona Summer Block Party (Edited)");
    await page.getByRole("button", { name: "Save changes" }).click();
    // Wait for save success message
    await page.locator(".admin-message-success").waitFor({ timeout: 5000 });
    await capture(page, runDirectory, "08-admin-workspace-save-success.png");
    console.log("  08-admin-workspace-save-success.png");
    if (consoleErrors.length > 0) {
      console.warn("  [workspace save success console errors]", consoleErrors);
    }
    await browser.close();
  }

  // 09 — backend save error: override the save-draft route to return 500
  {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Install the base mocks first (session + auth + allowlist + draft reads)
    await installMocks(page);
    // Then override save-draft to return 500 — Playwright uses most-recently-added handler first
    await page.route("**/functions/v1/save-draft", (route) => {
      void route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated backend error." }),
      });
    });

    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });

    const nameInput = page.locator('.admin-details-form .admin-details-grid .admin-input').first();
    await nameInput.fill("Madrona Summer Block Party (Error Test)");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.locator(".admin-message-error").waitFor({ timeout: 5000 });
    await capture(page, runDirectory, "09-admin-workspace-save-error.png");
    console.log("  09-admin-workspace-save-error.png");
    if (consoleErrors.length > 0) {
      console.warn("  [workspace save error console errors]", consoleErrors);
    }
    await browser.close();
  }
}

/**
 * Captures the question editor states (question list + focused question form).
 * Screenshots 10 (mobile question editor) and 11 (desktop question editor).
 */
async function captureAdminQuestionEditorStates(baseUrl, runDirectory, installMocks) {
  console.log("Capturing admin question editor states...");

  const eventId = ADMIN_DRAFT_DETAIL_FIXTURE[0].id;
  const workspaceUrl = `${baseUrl}/admin/events/${encodeURIComponent(eventId)}`;

  // 10 — mobile question editor
  {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installMocks(page);
    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });
    // Click the first question in the question list to open the editor
    await page.getByRole("button", { name: /Question 1:/ }).click();
    await page.locator(".admin-question-builder").waitFor({ timeout: 5000 });
    await capture(page, runDirectory, "10-admin-question-editor-mobile.png");
    console.log("  10-admin-question-editor-mobile.png");
    if (consoleErrors.length > 0) {
      console.warn("  [question editor mobile console errors]", consoleErrors);
    }
    await browser.close();
  }

  // 11 — desktop question editor
  {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installMocks(page);
    await page.goto(workspaceUrl, { waitUntil: "networkidle" });
    await page.locator(".admin-details-form").waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: /Question 1:/ }).click();
    await page.locator(".admin-question-builder").waitFor({ timeout: 5000 });
    await capture(page, runDirectory, "11-admin-question-editor-desktop.png");
    console.log("  11-admin-question-editor-desktop.png");
    if (consoleErrors.length > 0) {
      console.warn("  [question editor desktop console errors]", consoleErrors);
    }
    await browser.close();
  }
}

/**
 * Captures the unauthorized state (signed-in but not on the allowlist).
 * Screenshot 12.
 */
async function captureAdminUnauthorizedState(baseUrl, runDirectory) {
  console.log("Capturing admin unauthorized state...");

  const supabaseUrl = getAdminCaptureSupabaseUrl();
  // Build mocks with isAdmin=false
  const installMocks = buildAdminMocks(supabaseUrl, { isAdmin: false });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await installMocks(page);
  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "This account is not allowlisted for game authoring." }).waitFor({ timeout: 10000 });
  await capture(page, runDirectory, "12-admin-unauthorized.png");
  console.log("  12-admin-unauthorized.png");
  if (consoleErrors.length > 0) {
    console.warn("  [unauthorized console errors]", consoleErrors);
  }
  await browser.close();
}

/**
 * Orchestrates all admin UI capture steps.
 * Reads VITE_SUPABASE_URL from the environment or apps/web/.env — exits with a clear error if missing.
 */
async function captureAdminMode(baseUrl, runDirectory) {
  const supabaseUrl = getAdminCaptureSupabaseUrl();

  if (!supabaseUrl) {
    console.error(
      "Error: VITE_SUPABASE_URL is not set in the environment.\n" +
      "The admin capture mode uses Playwright route interception to mock Supabase\n" +
      "requests before they leave the machine, so no production data is read or\n" +
      "written. However, the capture script needs the same Supabase URL that the\n" +
      "Vite app reads at startup to register the correct request interceptors.\n\n" +
      "Set VITE_SUPABASE_URL in apps/web/.env or export it in the shell, then\n" +
      "re-run: npm run ui:review:capture:admin",
    );
    process.exit(1);
  }

  const installMocks = buildAdminMocks(supabaseUrl);

  await captureAdminSignInStates(baseUrl, runDirectory);
  await captureAdminAllEventsStates(baseUrl, runDirectory, installMocks);
  await captureAdminWorkspaceStates(baseUrl, runDirectory, installMocks);
  await captureAdminQuestionEditorStates(baseUrl, runDirectory, installMocks);
  await captureAdminUnauthorizedState(baseUrl, runDirectory);

  console.log(`Admin UI review artifacts written to ${runDirectory}`);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options["base-url"] ?? process.env.UI_REVIEW_BASE_URL ?? defaultBaseUrl;
  const errorBaseUrl = options["error-base-url"] ?? process.env.UI_REVIEW_ERROR_BASE_URL;
  const runDirectory = resolveRunDirectory(options["output-dir"]);

  if (options["mode"] === "admin") {
    await captureAdminMode(baseUrl, runDirectory);
    return;
  }

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
