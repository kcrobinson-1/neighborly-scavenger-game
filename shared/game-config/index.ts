export { featuredGameSlug } from "./constants.ts";
export {
  answersMatch,
  normalizeOptionIds,
  normalizeSubmittedAnswers,
  scoreAnswers,
  validateSubmittedAnswers,
} from "./answers.ts";
export { gamesById, gamesBySlug, getGameById, getGameBySlug } from "./catalog.ts";
export { games } from "./sample-games.ts";
export type {
  AnswerOption,
  AnswerValidationResult,
  FeedbackMode,
  GameConfig,
  Question,
  SelectionMode,
  SubmittedAnswers,
} from "./types.ts";
