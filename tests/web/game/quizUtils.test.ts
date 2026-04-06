import { describe, expect, it } from "vitest";
import {
  getNextSelection,
  getOptionLabels,
  getQuestionFeedbackMessage,
  getSelectionLabel,
} from "../../../apps/web/src/game/quizUtils.ts";

const singleSelectQuestion = {
  id: "q1",
  sponsor: "Sponsor One",
  prompt: "Question one?",
  selectionMode: "single" as const,
  correctAnswerIds: ["b"],
  options: [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
  ],
};

const multiSelectQuestion = {
  id: "q2",
  sponsor: "Sponsor Two",
  prompt: "Question two?",
  selectionMode: "multiple" as const,
  correctAnswerIds: ["a", "c"],
  options: [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
    { id: "c", label: "Option C" },
  ],
};

describe("quizUtils", () => {
  it("updates pending selection differently for single and multiple questions", () => {
    expect(getNextSelection(["a"], "b", "single")).toEqual(["b"]);
    expect(getNextSelection([], "a", "multiple")).toEqual(["a"]);
    expect(getNextSelection(["a"], "c", "multiple")).toEqual(["a", "c"]);
    expect(getNextSelection(["a", "c"], "a", "multiple")).toEqual(["c"]);
  });

  it("returns the expected selection hint copy for each question mode", () => {
    expect(getSelectionLabel(singleSelectQuestion)).toBe("Choose 1 answer.");
    expect(getSelectionLabel(multiSelectQuestion)).toBe(
      "Select every answer that fits.",
    );
  });

  it("maps stored option ids back to labels in the original id order", () => {
    expect(getOptionLabels(multiSelectQuestion, ["c", "a", "missing"])).toEqual([
      "Option C",
      "Option A",
    ]);
  });

  it("prefers sponsor fact, then explanation, then sponsor fallback for feedback copy", () => {
    expect(
      getQuestionFeedbackMessage({
        ...singleSelectQuestion,
        sponsorFact: "Sponsor fact first.",
        explanation: "Explanation second.",
      }),
    ).toBe("Sponsor fact first.");

    expect(
      getQuestionFeedbackMessage({
        ...singleSelectQuestion,
        explanation: "Explanation second.",
      }),
    ).toBe("Explanation second.");

    expect(getQuestionFeedbackMessage(singleSelectQuestion)).toBe(
      "Correct. Sponsor One is part of the neighborhood event experience.",
    );
  });
});
