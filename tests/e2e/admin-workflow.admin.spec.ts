import { expect, test } from "@playwright/test";
import {
  ensureAdminE2eFixture,
  installAuthoringFunctionProxy,
  readPublishedEventState,
} from "./admin-auth-fixture";

test.describe("admin authoring workflow", () => {
  test("covers save, publish, and unpublish on the shipped admin MVP path", async ({ page }) => {
    const fixture = await ensureAdminE2eFixture();
    const editedEventName = `${fixture.eventName} Updated`;
    const editedQuestionPrompt = "Phase 5.1 e2e prompt update";
    await installAuthoringFunctionProxy(page);

    await page.goto(fixture.magicLinkUrl, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Quiz draft access" })).toBeVisible();
    const eventCard = page.getByLabel(`${fixture.eventName} event`);
    await expect(eventCard).toBeVisible();

    await eventCard.getByRole("button", { name: "Open workspace" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/events/${fixture.eventId}$`));
    await expect(page.getByText(`Slug: ${fixture.eventSlug}`)).toBeVisible();

    await page.getByLabel("Event name").fill(editedEventName);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`Saved ${editedEventName}.`)).toBeVisible();

    await page.getByLabel("Question prompt").fill(editedQuestionPrompt);
    await page.getByRole("button", { name: "Save question changes" }).click();
    await expect(page.getByText("Saved question changes.")).toBeVisible();

    await page.getByRole("button", { name: "Publish draft" }).click();
    await expect(page.getByText(/Published as version/)).toBeVisible();

    const publishedState = await readPublishedEventState(fixture.eventId);
    expect(publishedState).not.toBeNull();
    expect(publishedState?.publishedAt).not.toBeNull();
    expect(publishedState?.slug).toBe(fixture.eventSlug);

    await page.goto(`/game/${fixture.eventSlug}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: editedEventName })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();

    await page.goto(`/admin/events/${fixture.eventId}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await page.getByRole("button", { name: "Confirm unpublish" }).click();

    await expect(page.getByText("Status: Draft only")).toBeVisible();

    const unpublishedState = await readPublishedEventState(fixture.eventId);
    expect(unpublishedState).not.toBeNull();
    expect(unpublishedState?.publishedAt).toBeNull();
    expect(unpublishedState?.slug).toBe(fixture.eventSlug);

    await page.goto(`/game/${fixture.eventSlug}`, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "This quiz isn't available right now." }),
    ).toBeVisible();
  });
});
