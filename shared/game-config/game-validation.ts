import { normalizeOptionIds } from "./answers.ts";
import type { GameConfig } from "./types.ts";

/** Throws immediately when sample data reuses an identifier that must be unique. */
function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }

    seen.add(value);
  }
}

/** Validates a single game config regardless of where its content originated. */
export function validateGameConfig(game: GameConfig) {
  if (game.questions.length === 0) {
    throw new Error(`Game "${game.id}" must include at least one question.`);
  }

  assertUnique(
    game.questions.map((question) => question.id),
    `question id in game "${game.id}"`,
  );

  for (const question of game.questions) {
    if (question.options.length === 0) {
      throw new Error(
        `Question "${question.id}" in game "${game.id}" must include at least one option.`,
      );
    }

    if (question.correctAnswerIds.length === 0) {
      throw new Error(
        `Question "${question.id}" in game "${game.id}" must include at least one correct answer.`,
      );
    }

    if (
      question.selectionMode === "single" &&
      normalizeOptionIds(question.correctAnswerIds).length !== 1
    ) {
      throw new Error(
        `Single-select question "${question.id}" in game "${game.id}" must have exactly one correct answer.`,
      );
    }

    assertUnique(
      question.options.map((option) => option.id),
      `option id in question "${question.id}"`,
    );

    const optionIds = new Set(question.options.map((option) => option.id));

    for (const correctAnswerId of question.correctAnswerIds) {
      if (!optionIds.has(correctAnswerId)) {
        throw new Error(
          `Question "${question.id}" in game "${game.id}" references unknown correct answer "${correctAnswerId}".`,
        );
      }
    }
  }
}

/** Validates a whole game collection before collection-level lookups are built. */
export function validateGames(games: GameConfig[]) {
  assertUnique(
    games.map((game) => game.id),
    "game id",
  );
  assertUnique(
    games.map((game) => game.slug),
    "game slug",
  );
  games.forEach(validateGameConfig);
}
