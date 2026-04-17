import type { AnswerOption, FeedbackMode, Question, SelectionMode } from "./types.ts";
import {
  expectNullableString,
  expectObjectArray,
  expectOptionalString,
  expectString,
  expectStringArray,
} from "./draft-json.ts";

type JsonRecord = Record<string, unknown>;

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
    sponsor: expectNullableString(input, "sponsor", `Question "${questionId}" sponsor`),
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

/** Reads and validates draft question JSON entries. */
export function parseQuestions(
  record: JsonRecord,
  key: string,
  label: string,
): Question[] {
  return expectObjectArray(record, key, label).map((question, index) =>
    parseQuestion(question, index));
}

/** Reads and validates the draft feedback mode field. */
export function parseFeedbackMode(
  record: JsonRecord,
  key: string,
  label: string,
): FeedbackMode {
  return expectFeedbackMode(record, key, label);
}
