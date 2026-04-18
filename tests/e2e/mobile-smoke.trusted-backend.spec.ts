import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertNoTrustedCompletionPersistedForRequest,
  assertTrustedAttendeeCompletionPersisted,
  installAttendeeFunctionProxy,
  type TamperedCompletionRequestCapture,
} from "./attendee-trusted-backend-fixture";

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

test("completes the attendee flow against trusted backend persistence", async ({
  page,
}) => {
  await installAttendeeFunctionProxy(page);

  await page.goto("/event/first-sample/game", { waitUntil: "networkidle" });
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
  await clickOptionAndSubmit(page, "A quick neighborhood game");
  await clickOptionAndSubmit(page, "5 to 7");
  await clickOptionAndSubmit(page, "Finishing the game");
  await clickOptionAndSubmit(page, "One card at a time");
  await clickOptionAndSubmit(page, "That the attendee is officially done");

  await expect(
    page.getByRole("heading", { name: "Show this screen at the volunteer table" }),
  ).toBeVisible();
  await expect(page.getByText("You're checked in for the reward.")).toBeVisible();

  const verificationCodeLocator = page.locator(".token-block strong");
  await expect(verificationCodeLocator).not.toHaveText("Loading...");
  const verificationCode = (await verificationCodeLocator.innerText()).trim();
  await expect(verificationCode).toMatch(/^[A-Z0-9-]+$/);

  await assertTrustedAttendeeCompletionPersisted(verificationCode);
});

test("rejects malformed completion payload before persistence, then succeeds on retry", async ({
  page,
}) => {
  const tamperedRequest: TamperedCompletionRequestCapture = {
    eventId: null,
    requestId: null,
  };

  await installAttendeeFunctionProxy(page, {
    captureTamperedCompletionRequest: tamperedRequest,
    tamperFirstCompletionPayload: true,
  });

  await page.goto("/event/first-sample/game", { waitUntil: "networkidle" });
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
  await clickOptionAndSubmit(page, "A quick neighborhood game");
  await clickOptionAndSubmit(page, "5 to 7");
  await clickOptionAndSubmit(page, "Finishing the game");
  await clickOptionAndSubmit(page, "One card at a time");
  await clickOptionAndSubmit(page, "That the attendee is officially done");

  await expect(
    page.getByRole("heading", { name: "We couldn't load your check-in code" }),
  ).toBeVisible();
  const retryButton = page.getByRole("button", { exact: true, name: "Try again" });
  await expect(retryButton).toBeVisible();
  await expect(page.getByText("Invalid completion payload.")).toBeVisible();

  expect(tamperedRequest.eventId).toBe("madrona-music-2026");
  expect(tamperedRequest.requestId).toBeTruthy();
  await assertNoTrustedCompletionPersistedForRequest(
    tamperedRequest.eventId ?? "",
    tamperedRequest.requestId ?? "",
  );

  await activate(retryButton);

  await expect(
    page.getByRole("heading", { name: "Show this screen at the volunteer table" }),
  ).toBeVisible();
  await expect(page.getByText("You're checked in for the reward.")).toBeVisible();

  const verificationCodeLocator = page.locator(".token-block strong");
  await expect(verificationCodeLocator).not.toHaveText("Loading...");
  const verificationCode = (await verificationCodeLocator.innerText()).trim();
  await expect(verificationCode).toMatch(/^[A-Z0-9-]+$/);

  await assertTrustedAttendeeCompletionPersisted(verificationCode);
});

test("shows bootstrap failure messaging when trusted session bootstrap fails", async ({
  page,
}) => {
  await installAttendeeFunctionProxy(page, {
    failFirstIssueSessionRequest: true,
  });

  await page.goto("/event/first-sample/game", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Madrona Music in the Playfield" }),
  ).toBeVisible();

  const startButton = page.getByRole("button", { exact: true, name: "Start game" });
  await expect(startButton).toBeVisible();
  await activate(startButton);

  await expect(
    page.getByText("Can't start the game right now."),
  ).toBeVisible();
  await expect(page.getByText("Backend bootstrap smoke failure.")).toBeVisible();
  await expect(startButton).toBeVisible();
});
