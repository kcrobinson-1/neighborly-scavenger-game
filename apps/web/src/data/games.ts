/** Re-export shared quiz types plus explicit sample fixtures for prototype-only paths. */
export {
  type AnswerOption,
  type FeedbackMode,
  type GameConfig,
  type Question,
  type SelectionMode,
  type SubmittedAnswers,
} from "../../../../shared/game-config";

export {
  featuredGameSlug,
  games,
  gamesById,
  gamesBySlug,
  getGameById,
  getGameBySlug,
} from "../../../../shared/game-config/sample-fixtures.ts";
