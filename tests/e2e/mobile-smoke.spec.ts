import { expect, test, type Locator, type Page } from "@playwright/test";

/** Scrolls the target into view so Playwright can use its normal actionability checks. */
async function activate(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

/** Selects an answer and submits the question with normal browser-like interactions. */
async function clickOptionAndSubmit(
  page: Page,
  optionLabel: string,
  submitLabel = "Submit answer",
) {
  await activate(page.getByText(optionLabel, { exact: true }));
  await activate(page.getByRole("button", { exact: true, name: submitLabel }));
}

test("loads the featured attendee route directly", async ({ page }) => {
  await page.goto("/event/first-sample/game", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "Madrona Music in the Playfield" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("completes the featured attendee flow on mobile", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  await activate(page.getByRole("button", { exact: true, name: "Try the attendee demo" }));
  await expect(page).toHaveURL(/\/event\/first-sample\/game$/);
  await expect(
    page.getByRole("heading", { name: "Madrona Music in the Playfield" }),
  ).toBeVisible();

  await activate(page.getByRole("button", { exact: true, name: "Start game" }));
  await expect(
    page.getByRole("heading", {
      name: "Which local spot is sponsoring this neighborhood music series question?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "Hi Spot Cafe");
  await expect(
    page.getByRole("heading", {
      name: "What kind of experience should this game feel like?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "A quick neighborhood game");
  await expect(
    page.getByRole("heading", {
      name: "How many questions should the MVP generally ask attendees?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "5 to 7");
  await expect(
    page.getByRole("heading", {
      name: "What matters most for reward eligibility in the MVP?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "Finishing the game");
  await expect(
    page.getByRole("heading", {
      name: "How should questions appear in the experience?",
    }),
  ).toBeVisible();

  await activate(page.getByRole("button", { exact: true, name: "Back to the previous question" }));
  await expect(
    page.getByRole("heading", {
      name: "What matters most for reward eligibility in the MVP?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "Finishing the game");
  await expect(
    page.getByRole("heading", {
      name: "How should questions appear in the experience?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "One card at a time");
  await expect(
    page.getByRole("heading", {
      name: "What should the final screen make obvious?",
    }),
  ).toBeVisible();

  await clickOptionAndSubmit(page, "That the attendee is officially done");

  await expect(
    page.getByRole("heading", { name: "Show this screen at the volunteer table" }),
  ).toBeVisible();
  await expect(page.getByText("You're checked in for the reward.")).toBeVisible();
  await expect(page.locator(".token-block strong")).not.toHaveText("Loading...");
});

test("shows the not-found fallback for invalid routes and missing game slugs", async ({ page }) => {
  await page.goto("/not-a-route", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "That page isn't available in this demo." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to demo overview" })).toBeVisible();

  await page.goto("/event/not-a-real-sample/game", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", { name: "This game isn't available right now." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to demo overview" })).toBeVisible();
});
