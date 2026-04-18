import type { AuthoringGameDraftContent } from "../../../../shared/game-config";
import type { DraftEventDetail, DraftEventSummary } from "../lib/adminGameApi";

const STARTER_DRAFT_BASE_NAME = "Untitled event";
const DEFAULT_SUFFIX_LENGTH = 6;

type ExistingDraftIdentity = Pick<DraftEventSummary, "id" | "slug">;

function createDraftSuffix() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 2 + DEFAULT_SUFFIX_LENGTH);

  return `${timestamp}-${randomPart}`;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "draft-event";
}

function createUniqueIdentity(
  baseName: string,
  existingDrafts: ExistingDraftIdentity[],
  suffix = createDraftSuffix(),
) {
  const existingIds = new Set(existingDrafts.map((draft) => draft.id));
  const existingSlugs = new Set(existingDrafts.map((draft) => draft.slug));
  const baseSlug = slugify(baseName);
  let candidate = `${baseSlug}-${slugify(suffix)}`;
  let attempt = 2;

  while (existingIds.has(candidate) || existingSlugs.has(candidate)) {
    candidate = `${baseSlug}-${slugify(suffix)}-${attempt}`;
    attempt += 1;
  }

  return {
    id: candidate,
    slug: candidate,
  };
}

/** Creates a canonical starter draft that passes the current shared draft validator. */
export function createStarterDraftContent(
  existingDrafts: ExistingDraftIdentity[],
  suffix?: string,
): AuthoringGameDraftContent {
  const displaySuffix = suffix ?? createDraftSuffix();
  const identity = createUniqueIdentity(
    STARTER_DRAFT_BASE_NAME,
    existingDrafts,
    displaySuffix,
  );

  return {
    ...identity,
    allowBackNavigation: true,
    allowRetake: true,
    estimatedMinutes: 2,
    feedbackMode: "final_score_reveal",
    intro: "Add the event intro before publishing.",
    location: "TBD",
    name: `${STARTER_DRAFT_BASE_NAME} ${displaySuffix}`,
    questions: [
      {
        correctAnswerIds: ["a"],
        id: "q1",
        options: [
          { id: "a", label: "Correct answer" },
          { id: "b", label: "Alternate answer" },
        ],
        prompt: "Replace this placeholder question.",
        selectionMode: "single",
        sponsor: "Sponsor name",
      },
    ],
    entitlementLabel: "reward ticket",
    slug: identity.slug,
    summary: "Add the event summary before publishing.",
  };
}

/** Copies a private draft document into a new unpublished draft identity. */
export function createDuplicatedDraftContent(
  sourceDraft: DraftEventDetail,
  existingDrafts: ExistingDraftIdentity[],
  suffix?: string,
): AuthoringGameDraftContent {
  const nextName = `${sourceDraft.content.name} Copy`;
  const identity = createUniqueIdentity(nextName, existingDrafts, suffix);

  return {
    ...structuredClone(sourceDraft.content),
    ...identity,
    name: nextName,
  };
}
