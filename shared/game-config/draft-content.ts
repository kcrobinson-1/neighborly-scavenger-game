import { validateGameConfig } from "./game-validation.ts";
import type {
  AnswerOption,
  FeedbackMode,
  GameConfig,
  Question,
  SelectionMode,
} from "./types.ts";

type JsonRecord = Record<string, unknown>;

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

function expectRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as JsonRecord;
}

function expectString(record: JsonRecord, key: string, label: string): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function expectOptionalString(
  record: JsonRecord,
  key: string,
  label: string,
): string | undefined {
  if (!(key in record)) {
    return undefined;
  }

  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided.`);
  }

  return value;
}

function expectOptionalBoolean(
  record: JsonRecord,
  key: string,
  label: string,
): boolean | undefined {
  if (!(key in record)) {
    return undefined;
  }

  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when provided.`);
  }

  return value;
}

function expectPositiveInteger(
  record: JsonRecord,
  key: string,
  label: string,
): number {
  const value = record[key];

  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return value as number;
}

function expectStringArray(
  record: JsonRecord,
  key: string,
  label: string,
): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${label} entry ${index + 1} must be a string.`);
    }

    return entry;
  });
}

function expectObjectArray(
  record: JsonRecord,
  key: string,
  label: string,
): JsonRecord[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) =>
    expectRecord(entry, `${label} entry ${index + 1}`));
}

function expectFeedbackMode(
  record: JsonRecord,
  key: string,
  label: string,
): FeedbackMode {
  const value = expectString(record, key, label);

  if (
    value !== "final_score_reveal" &&
    value !== "instant_feedback_required"
  ) {
    throw new Error(
      `${label} must be "final_score_reveal" or "instant_feedback_required".`,
    );
  }

  return value;
}

function expectSelectionMode(
  record: JsonRecord,
  key: string,
  label: string,
): SelectionMode {
  const value = expectString(record, key, label);

  if (value !== "single" && value !== "multiple") {
    throw new Error(`${label} must be "single" or "multiple".`);
  }

  return value;
}

function parseAnswerOption(
  input: JsonRecord,
  questionId: string,
  index: number,
): AnswerOption {
  return {
    id: expectString(
      input,
      "id",
      `Question "${questionId}" option ${index + 1} id`,
    ),
    label: expectString(
      input,
      "label",
      `Question "${questionId}" option ${index + 1} label`,
    ),
  };
}

function parseQuestion(input: JsonRecord, index: number): Question {
  const questionId = expectString(input, "id", `Question ${index + 1} id`);
  const explanation = expectOptionalString(
    input,
    "explanation",
    `Question "${questionId}" explanation`,
  );
  const sponsorFact = expectOptionalString(
    input,
    "sponsorFact",
    `Question "${questionId}" sponsorFact`,
  );

  return {
    id: questionId,
    sponsor: expectString(input, "sponsor", `Question "${questionId}" sponsor`),
    prompt: expectString(input, "prompt", `Question "${questionId}" prompt`),
    selectionMode: expectSelectionMode(
      input,
      "selectionMode",
      `Question "${questionId}" selection mode`,
    ),
    correctAnswerIds: expectStringArray(
      input,
      "correctAnswerIds",
      `Question "${questionId}" correctAnswerIds`,
    ),
    options: expectObjectArray(
      input,
      "options",
      `Question "${questionId}" options`,
    ).map((option, optionIndex) =>
      parseAnswerOption(option, questionId, optionIndex)),
    ...(explanation !== undefined ? { explanation } : {}),
    ...(sponsorFact !== undefined ? { sponsorFact } : {}),
  };
}

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
    feedbackMode: expectFeedbackMode(
      record,
      "feedbackMode",
      'Draft content "feedbackMode"',
    ),
    questions: expectObjectArray(
      record,
      "questions",
      'Draft content "questions"',
    ).map((question, index) => parseQuestion(question, index)),
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
