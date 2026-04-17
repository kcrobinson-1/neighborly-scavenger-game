import { validateGameConfig } from "./game-validation.ts";
import {
  expectOptionalBoolean,
  expectPositiveInteger,
  expectRecord,
  expectString,
} from "./draft-json.ts";
import {
  parseFeedbackMode,
  parseQuestions,
} from "./draft-question-parsing.ts";
import type {
  GameConfig,
} from "./types.ts";

/** Canonical authoring payload persisted for one event draft or version. */
export type AuthoringGameDraftContent = GameConfig;

/** Draft row persisted in the private authoring table. */
export type AuthoringGameDraftRow = {
  content: AuthoringGameDraftContent;
  created_at: string;
  id: string;
  last_saved_by: string | null;
  live_version_number: number | null;
  name: string;
  schema_version: number;
  slug: string;
  updated_at: string;
};

/** Immutable published snapshot row persisted in the private versions table. */
export type AuthoringGameVersionRow = {
  content: AuthoringGameDraftContent;
  event_id: string;
  published_at: string;
  published_by: string | null;
  schema_version: number;
  version_number: number;
};


/** Parses unknown JSON into the canonical authoring draft payload shape. */
export function parseAuthoringGameDraftContent(
  input: unknown,
): AuthoringGameDraftContent {
  const record = expectRecord(input, "Draft content");
  const allowBackNavigation = expectOptionalBoolean(
    record,
    "allowBackNavigation",
    'Draft content "allowBackNavigation"',
  );
  const allowRetake = expectOptionalBoolean(
    record,
    "allowRetake",
    'Draft content "allowRetake"',
  );

  const draft: AuthoringGameDraftContent = {
    id: expectString(record, "id", 'Draft content "id"'),
    slug: expectString(record, "slug", 'Draft content "slug"'),
    name: expectString(record, "name", 'Draft content "name"'),
    location: expectString(record, "location", 'Draft content "location"'),
    estimatedMinutes: expectPositiveInteger(
      record,
      "estimatedMinutes",
      'Draft content "estimatedMinutes"',
    ),
    raffleLabel: expectString(
      record,
      "raffleLabel",
      'Draft content "raffleLabel"',
    ),
    intro: expectString(record, "intro", 'Draft content "intro"'),
    summary: expectString(record, "summary", 'Draft content "summary"'),
    feedbackMode: parseFeedbackMode(
      record,
      "feedbackMode",
      'Draft content "feedbackMode"',
    ),
    questions: parseQuestions(
      record,
      "questions",
      'Draft content "questions"',
    ),
  };

  if (allowBackNavigation !== undefined) {
    draft.allowBackNavigation = allowBackNavigation;
  }

  if (allowRetake !== undefined) {
    draft.allowRetake = allowRetake;
  }

  validateAuthoringGameDraftContent(draft);
  return draft;
}

/** Validates the canonical authoring draft payload before it is saved or published. */
export function validateAuthoringGameDraftContent(
  draft: AuthoringGameDraftContent,
) {
  mapAuthoringGameDraftContentToGameConfig(draft);
}

/** Maps canonical authoring draft JSON into the shared runtime GameConfig shape. */
export function mapAuthoringGameDraftContentToGameConfig(
  draft: AuthoringGameDraftContent,
): GameConfig {
  const game: GameConfig = {
    id: draft.id,
    slug: draft.slug,
    name: draft.name,
    location: draft.location,
    estimatedMinutes: draft.estimatedMinutes,
    raffleLabel: draft.raffleLabel,
    intro: draft.intro,
    summary: draft.summary,
    feedbackMode: draft.feedbackMode,
    questions: draft.questions.map((question) => ({
      id: question.id,
      sponsor: question.sponsor,
      prompt: question.prompt,
      selectionMode: question.selectionMode,
      correctAnswerIds: [...question.correctAnswerIds],
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
      ...(question.explanation !== undefined
        ? { explanation: question.explanation }
        : {}),
      ...(question.sponsorFact !== undefined
        ? { sponsorFact: question.sponsorFact }
        : {}),
    })),
    ...(draft.allowBackNavigation !== undefined
      ? { allowBackNavigation: draft.allowBackNavigation }
      : {}),
    ...(draft.allowRetake !== undefined
      ? { allowRetake: draft.allowRetake }
      : {}),
  };

  validateGameConfig(game);
  return game;
}
