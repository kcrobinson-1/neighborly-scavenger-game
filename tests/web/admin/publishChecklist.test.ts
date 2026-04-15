import { describe, expect, it } from "vitest";
import { getGameById } from "../../../shared/game-config/sample-fixtures";
import {
  computePublishChecklist,
  isPublishReady,
} from "../../../apps/web/src/admin/publishChecklist";

const sampleGame = getGameById("madrona-music-2026");

if (!sampleGame) {
  throw new Error("Expected the Madrona sample game to exist.");
}

describe("computePublishChecklist", () => {
  it("returns all checks passed for a valid draft", () => {
    const checklist = computePublishChecklist(sampleGame);

    expect(checklist).toHaveLength(5);
    expect(checklist.every((item) => item.passed)).toBe(true);
    expect(checklist.every((item) => item.detail === undefined)).toBe(true);
  });

  it("fails check 1 when there are zero questions", () => {
    const content = { ...sampleGame, questions: [] };
    const checklist = computePublishChecklist(content);
    const check1 = checklist.find((item) => item.id === "has-questions");

    expect(check1?.passed).toBe(false);
  });

  it("fails check 2 when a question has no options, and detail names the question prompt", () => {
    const shortPrompt = "Short prompt";
    const content = {
      ...sampleGame,
      questions: [
        {
          ...sampleGame.questions[0],
          options: [],
          prompt: shortPrompt,
        },
        ...sampleGame.questions.slice(1),
      ],
    };
    const checklist = computePublishChecklist(content);
    const check2 = checklist.find(
      (item) => item.id === "all-questions-have-options",
    );

    expect(check2?.passed).toBe(false);
    expect(check2?.detail).toBe(shortPrompt);
  });

  it("fails check 3 when a question has no correct answers, and detail names the question prompt", () => {
    const shortPrompt = "Short prompt";
    const content = {
      ...sampleGame,
      questions: [
        {
          ...sampleGame.questions[0],
          correctAnswerIds: [],
          prompt: shortPrompt,
        },
        ...sampleGame.questions.slice(1),
      ],
    };
    const checklist = computePublishChecklist(content);
    const check3 = checklist.find(
      (item) => item.id === "all-questions-have-correct-answer",
    );

    expect(check3?.passed).toBe(false);
    expect(check3?.detail).toBe(shortPrompt);
  });

  it("fails check 4 when a single-select question has more than one correct answer, and detail names the question", () => {
    const shortPrompt = "Short prompt";
    const content = {
      ...sampleGame,
      questions: [
        {
          ...sampleGame.questions[0],
          correctAnswerIds: ["a", "b"],
          prompt: shortPrompt,
          selectionMode: "single" as const,
        },
        ...sampleGame.questions.slice(1),
      ],
    };
    const checklist = computePublishChecklist(content);
    const check4 = checklist.find(
      (item) => item.id === "single-select-one-correct",
    );

    expect(check4?.passed).toBe(false);
    expect(check4?.detail).toBe(shortPrompt);
  });

  it("fails check 5 when a correct answer ID does not reference an existing option, and detail names the question", () => {
    const shortPrompt = "Short prompt";
    const content = {
      ...sampleGame,
      questions: [
        {
          ...sampleGame.questions[0],
          correctAnswerIds: ["nonexistent-option-id"],
          prompt: shortPrompt,
        },
        ...sampleGame.questions.slice(1),
      ],
    };
    const checklist = computePublishChecklist(content);
    const check5 = checklist.find(
      (item) => item.id === "correct-answer-ids-valid",
    );

    expect(check5?.passed).toBe(false);
    expect(check5?.detail).toBe(shortPrompt);
  });

  it("truncates long question prompts in the detail field", () => {
    const longPrompt = "A".repeat(80);
    const content = {
      ...sampleGame,
      questions: [
        {
          ...sampleGame.questions[0],
          correctAnswerIds: [],
          prompt: longPrompt,
        },
        ...sampleGame.questions.slice(1),
      ],
    };
    const checklist = computePublishChecklist(content);
    const check3 = checklist.find(
      (item) => item.id === "all-questions-have-correct-answer",
    );

    expect(check3?.detail).toMatch(/…$/);
    expect((check3?.detail ?? "").length).toBeLessThan(longPrompt.length);
  });

  it("includes all 5 check ids in order", () => {
    const checklist = computePublishChecklist(sampleGame);
    const ids = checklist.map((item) => item.id);

    expect(ids).toEqual([
      "has-questions",
      "all-questions-have-options",
      "all-questions-have-correct-answer",
      "single-select-one-correct",
      "correct-answer-ids-valid",
    ]);
  });
});

describe("isPublishReady", () => {
  it("returns true when all checklist items pass", () => {
    const checklist = computePublishChecklist(sampleGame);

    expect(isPublishReady(checklist)).toBe(true);
  });

  it("returns false when any checklist item fails", () => {
    const content = { ...sampleGame, questions: [] };
    const checklist = computePublishChecklist(content);

    expect(isPublishReady(checklist)).toBe(false);
  });

  it("returns false when only one item fails", () => {
    const content = {
      ...sampleGame,
      questions: [
        {
          ...sampleGame.questions[0],
          correctAnswerIds: [],
        },
        ...sampleGame.questions.slice(1),
      ],
    };
    const checklist = computePublishChecklist(content);

    expect(isPublishReady(checklist)).toBe(false);
  });
});
