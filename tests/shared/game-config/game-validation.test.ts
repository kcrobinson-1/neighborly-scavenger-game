import { describe, expect, it } from "vitest";
import { validateGames } from "../../../shared/game-config/game-validation.ts";
import { createTestGame } from "./fixtures.ts";

// The catalog validates sample data at module load time, so these tests focus
// on the bad-definition cases that should fail fast before the app boots.
describe("validateGames", () => {
  it("accepts a valid game collection", () => {
    expect(() => validateGames([createTestGame()])).not.toThrow();
  });

  it("rejects duplicate game ids", () => {
    const first = createTestGame();
    const second = {
      ...createTestGame(),
      slug: "test-game-two",
    };

    expect(() => validateGames([first, second])).toThrow("Duplicate game id: test-game");
  });

  it("rejects duplicate game slugs", () => {
    const first = createTestGame();
    const second = {
      ...createTestGame(),
      id: "test-game-two",
    };

    expect(() => validateGames([first, second])).toThrow("Duplicate game slug: test-game");
  });

  it("rejects games without questions", () => {
    const game = {
      ...createTestGame(),
      questions: [],
    };

    expect(() => validateGames([game])).toThrow(
      'Game "test-game" must include at least one question.',
    );
  });

  it("rejects questions with duplicate option ids", () => {
    const game = createTestGame();
    game.questions[0] = {
      ...game.questions[0],
      options: [
        { id: "a", label: "Option A" },
        { id: "a", label: "Option A duplicate" },
      ],
    };

    expect(() => validateGames([game])).toThrow(
      'Duplicate option id in question "q1": a',
    );
  });

  it("rejects single-select questions with multiple correct answers", () => {
    const game = createTestGame();
    game.questions[0] = {
      ...game.questions[0],
      correctAnswerIds: ["a", "b"],
    };

    expect(() => validateGames([game])).toThrow(
      'Single-select question "q1" in game "test-game" must have exactly one correct answer.',
    );
  });

  it("rejects correct answers that do not exist in the options", () => {
    const game = createTestGame();
    game.questions[1] = {
      ...game.questions[1],
      correctAnswerIds: ["z"],
    };

    expect(() => validateGames([game])).toThrow(
      'Question "q2" in game "test-game" references unknown correct answer "z".',
    );
  });
});
