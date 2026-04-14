import { describe, expect, it } from "vitest";
import { getGameById } from "../../../shared/game-config/sample-fixtures";
import {
  applyEventDetailsFormValues,
  createEventDetailsFormValues,
} from "../../../apps/web/src/admin/eventDetails";

const sampleGame = getGameById("madrona-music-2026");

if (!sampleGame) {
  throw new Error("Expected the Madrona sample game to exist.");
}

describe("createEventDetailsFormValues", () => {
  it("maps canonical draft content into string-backed form values", () => {
    const values = createEventDetailsFormValues(sampleGame);

    expect(values).toMatchObject({
      allowBackNavigation: true,
      allowRetake: true,
      estimatedMinutes: String(sampleGame.estimatedMinutes),
      feedbackMode: sampleGame.feedbackMode,
      intro: sampleGame.intro,
      location: sampleGame.location,
      name: sampleGame.name,
      raffleLabel: sampleGame.raffleLabel,
      slug: sampleGame.slug,
      summary: sampleGame.summary,
    });
  });
});

describe("applyEventDetailsFormValues", () => {
  it("applies trimmed event details and preserves question content", () => {
    const nextContent = applyEventDetailsFormValues(sampleGame, {
      ...createEventDetailsFormValues(sampleGame),
      allowBackNavigation: false,
      allowRetake: false,
      estimatedMinutes: " 4 ",
      feedbackMode: "instant_feedback_required",
      intro: " Updated intro ",
      location: " Playfield ",
      name: " Updated Event ",
      raffleLabel: " bonus entry ",
      slug: " updated-event ",
      summary: " Updated summary ",
    });

    expect(nextContent).toMatchObject({
      allowBackNavigation: false,
      allowRetake: false,
      estimatedMinutes: 4,
      feedbackMode: "instant_feedback_required",
      intro: "Updated intro",
      location: "Playfield",
      name: "Updated Event",
      raffleLabel: "bonus entry",
      slug: "updated-event",
      summary: "Updated summary",
    });
    expect(nextContent.id).toBe(sampleGame.id);
    expect(nextContent.questions).toEqual(sampleGame.questions);
  });

  it("rejects blank required fields", () => {
    expect(() =>
      applyEventDetailsFormValues(sampleGame, {
        ...createEventDetailsFormValues(sampleGame),
        name: " ",
      }),
    ).toThrow("Event name is required.");
  });

  it("rejects non-positive estimated minutes", () => {
    expect(() =>
      applyEventDetailsFormValues(sampleGame, {
        ...createEventDetailsFormValues(sampleGame),
        estimatedMinutes: "0",
      }),
    ).toThrow("Estimated minutes must be a positive whole number.");
  });
});
