import type {
  AnswerValidationResult,
  GameConfig,
  SubmittedAnswers,
} from "./types.ts";

/** Normalizes selected option ids into a stable, deduplicated order. */
export function normalizeOptionIds(optionIds: string[]) {
  return [...new Set(optionIds)].sort();
}

/** Compares two answer sets after canonical normalization. */
export function answersMatch(
  selectedOptionIds: string[],
  correctAnswerIds: string[],
) {
  const selected = normalizeOptionIds(selectedOptionIds);
  const correct = normalizeOptionIds(correctAnswerIds);

  if (selected.length !== correct.length) {
    return false;
  }

  return selected.every((optionId, index) => optionId === correct[index]);
}

/** Computes a game score from the current answer payload. */
export function scoreAnswers(game: GameConfig, answers: SubmittedAnswers) {
  return game.questions.reduce((total, question) => {
    return total + Number(answersMatch(answers[question.id] ?? [], question.correctAnswerIds));
  }, 0);
}

/** Produces a fully-populated, canonical answer payload for persistence. */
export function normalizeSubmittedAnswers(
  game: GameConfig,
  answers: SubmittedAnswers,
) {
  // Persist answers in a canonical form so duplicate ids or different ordering
  // do not create inconsistent records across analytics, review, and scoring.
  return Object.fromEntries(
    game.questions.map((question) => [
      question.id,
      normalizeOptionIds(answers[question.id] ?? []),
    ]),
  ) as SubmittedAnswers;
}

/** Verifies that submitted answers match the configured question schema. */
export function validateSubmittedAnswers(
  game: GameConfig,
  answers: SubmittedAnswers,
): AnswerValidationResult {
  const knownQuestionIds = new Set(game.questions.map((question) => question.id));
  const submittedQuestionIds = Object.keys(answers);

  for (const submittedQuestionId of submittedQuestionIds) {
    if (!knownQuestionIds.has(submittedQuestionId)) {
      return {
        error: `Unknown question id: ${submittedQuestionId}.`,
        ok: false,
      };
    }
  }

  for (const question of game.questions) {
    const selectedOptionIds = answers[question.id];

    if (!Array.isArray(selectedOptionIds) || selectedOptionIds.length === 0) {
      return {
        error: `Question ${question.id} is missing an answer.`,
        ok: false,
      };
    }

    const normalizedSelection = normalizeOptionIds(selectedOptionIds);

    if (
      question.selectionMode === "single" &&
      normalizedSelection.length !== 1
    ) {
      return {
        error: `Question ${question.id} must have exactly one selected answer.`,
        ok: false,
      };
    }

    const validOptionIds = new Set(question.options.map((option) => option.id));

    if (normalizedSelection.some((optionId) => !validOptionIds.has(optionId))) {
      return {
        error: `Question ${question.id} contains an invalid answer option.`,
        ok: false,
      };
    }
  }

  return { ok: true };
}
