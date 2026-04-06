import { describe, expect, it } from "vitest";
import {
  answersMatch,
  normalizeOptionIds,
  normalizeSubmittedAnswers,
  scoreAnswers,
  validateSubmittedAnswers,
} from "../../../shared/game-config/answers.ts";
import { createTestGame } from "./fixtures.ts";

// These tests intentionally sit at the shared domain layer because the same
// logic is trusted by both the browser and the Supabase completion path.
describe("normalizeOptionIds", () => {
  it("deduplicates and sorts selected option ids", () => {
    expect(normalizeOptionIds(["c", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
});

describe("answersMatch", () => {
  it("treats answer ordering as irrelevant", () => {
    expect(answersMatch(["c", "a"], ["a", "c"])).toBe(true);
  });

  it("returns false when the selected ids do not match exactly", () => {
    expect(answersMatch(["a"], ["a", "c"])).toBe(false);
  });
});

describe("scoreAnswers", () => {
  it("scores correct and incorrect answers against the configured questions", () => {
    const game = createTestGame();

    expect(
      scoreAnswers(game, {
        q1: ["b"],
        q2: ["c", "a"],
      }),
    ).toBe(2);

    expect(
      scoreAnswers(game, {
        q1: ["a"],
        q2: ["a", "c"],
      }),
    ).toBe(1);
  });
});

describe("normalizeSubmittedAnswers", () => {
  it("returns a canonical answer object for every configured question", () => {
    const game = createTestGame();

    // Unknown keys should be dropped here because persistence and scoring only
    // care about the configured question set, not whatever the caller sends.
    expect(
      normalizeSubmittedAnswers(game, {
        q1: ["b"],
        q2: ["c", "a", "a"],
        ignored: ["x"],
      }),
    ).toEqual({
      q1: ["b"],
      q2: ["a", "c"],
    });
  });
});

describe("validateSubmittedAnswers", () => {
  it("accepts a complete payload with valid option ids", () => {
    const game = createTestGame();

    expect(
      validateSubmittedAnswers(game, {
        q1: ["b"],
        q2: ["c", "a"],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects unknown question ids", () => {
    const game = createTestGame();

    expect(
      validateSubmittedAnswers(game, {
        q1: ["b"],
        q2: ["a", "c"],
        q3: ["z"],
      }),
    ).toEqual({
      error: "Unknown question id: q3.",
      ok: false,
    });
  });

  it("rejects missing answers", () => {
    const game = createTestGame();

    expect(
      validateSubmittedAnswers(game, {
        q1: ["b"],
      }),
    ).toEqual({
      error: "Question q2 is missing an answer.",
      ok: false,
    });
  });

  it("rejects invalid option ids", () => {
    const game = createTestGame();

    expect(
      validateSubmittedAnswers(game, {
        q1: ["b"],
        q2: ["a", "z"],
      }),
    ).toEqual({
      error: "Question q2 contains an invalid answer option.",
      ok: false,
    });
  });

  it("rejects single-select questions with more than one answer", () => {
    const game = createTestGame();

    expect(
      validateSubmittedAnswers(game, {
        q1: ["a", "b"],
        q2: ["a", "c"],
      }),
    ).toEqual({
      error: "Question q1 must have exactly one selected answer.",
      ok: false,
    });
  });
});
