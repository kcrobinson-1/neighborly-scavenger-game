import { describe, expect, it } from "vitest";
import {
  validateAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
} from "../../../shared/game-config";
import { getGameById } from "../../../shared/game-config/sample-fixtures";
import type { DraftEventDetail, DraftEventSummary } from "../../../apps/web/src/lib/adminGameApi";
import {
  createDuplicatedDraftContent,
  createStarterDraftContent,
} from "../../../apps/web/src/admin/draftCreation";

const sampleGame = getGameById("madrona-music-2026");

if (!sampleGame) {
  throw new Error("Expected the Madrona sample game to exist.");
}

function createSourceDraft(
  content: AuthoringGameDraftContent = sampleGame,
): DraftEventDetail {
  return {
    content,
    createdAt: "2026-04-07T12:00:00.000Z",
    id: content.id,
    lastSavedBy: "22222222-2222-4222-8222-222222222222",
    liveVersionNumber: 1,
    name: content.name,
    slug: content.slug,
    updatedAt: "2026-04-08T12:00:00.000Z",
  };
}

describe("createStarterDraftContent", () => {
  it("creates a valid canonical starter draft with a generated identity", () => {
    const draft = createStarterDraftContent([], "abc123");

    expect(draft.id).toBe("untitled-event-abc123");
    expect(draft.slug).toBe("untitled-event-abc123");
    expect(draft.name).toBe("Untitled event abc123");
    expect(() => validateAuthoringGameDraftContent(draft)).not.toThrow();
  });

  it("avoids visible draft id and slug collisions", () => {
    const existingDrafts: DraftEventSummary[] = [
      {
        id: "untitled-event-abc123",
        liveVersionNumber: null,
        name: "Untitled event abc123",
        slug: "untitled-event-abc123",
        updatedAt: "2026-04-08T12:00:00.000Z",
      },
    ];

    const draft = createStarterDraftContent(existingDrafts, "abc123");

    expect(draft.id).toBe("untitled-event-abc123-2");
    expect(draft.slug).toBe("untitled-event-abc123-2");
    expect(() => validateAuthoringGameDraftContent(draft)).not.toThrow();
  });
});

describe("createDuplicatedDraftContent", () => {
  it("copies draft content with a new unpublished draft identity", () => {
    const duplicate = createDuplicatedDraftContent(createSourceDraft(), [], "copy1");

    expect(duplicate.id).toBe("madrona-music-in-the-playfield-copy-copy1");
    expect(duplicate.slug).toBe("madrona-music-in-the-playfield-copy-copy1");
    expect(duplicate.name).toBe("Madrona Music in the Playfield Copy");
    expect(duplicate.questions).toEqual(sampleGame.questions);
    expect(duplicate.feedbackMode).toBe(sampleGame.feedbackMode);
    expect(() => validateAuthoringGameDraftContent(duplicate)).not.toThrow();
  });

  it("does not mutate the source draft content", () => {
    const sourceDraft = createSourceDraft();
    const sourceContentBefore = structuredClone(sourceDraft.content);

    createDuplicatedDraftContent(sourceDraft, [], "copy1");

    expect(sourceDraft.content).toEqual(sourceContentBefore);
  });
});
