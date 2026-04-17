/**
 * Public shared quiz-domain entrypoint consumed by frontend and edge functions.
 * Exports canonical runtime types plus mapping/validation/scoring helpers.
 * Intentionally excludes sample fixtures, which stay in sample-fixtures.ts for
 * tests and explicit local prototype fallback usage.
 */
export {
  answersMatch,
  normalizeOptionIds,
  normalizeSubmittedAnswers,
  scoreAnswers,
  validateSubmittedAnswers,
} from "./answers.ts";
export {
  mapAuthoringGameDraftContentToGameConfig,
  parseAuthoringGameDraftContent,
  validateAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
  type AuthoringGameDraftRow,
  type AuthoringGameVersionRow,
} from "./draft-content.ts";
export {
  mapPublishedGameRowsToGameConfig,
  type PublishedGameEventRow,
  type PublishedGameOptionRow,
  type PublishedGameQuestionRow,
  type PublishedGameRows,
} from "./db-content.ts";
export { validateGameConfig, validateGames } from "./game-validation.ts";
export type {
  AnswerOption,
  AnswerValidationResult,
  FeedbackMode,
  GameConfig,
  Question,
  SelectionMode,
  SubmittedAnswers,
} from "./types.ts";
