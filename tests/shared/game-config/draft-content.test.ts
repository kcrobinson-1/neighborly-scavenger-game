import { describe, expect, it } from "vitest";
import {
  mapAuthoringGameDraftContentToGameConfig,
  parseAuthoringGameDraftContent,
  validateAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
} from "../../../shared/game-config.ts";
import { createTestGame } from "./fixtures.ts";

function createAuthoringDraft(
  overrides: Partial<AuthoringGameDraftContent> = {},
): AuthoringGameDraftContent {
  return {
    ...createTestGame(),
    allowBackNavigation: true,
    allowRetake: true,
    ...overrides,
  };
}

describe("parseAuthoringGameDraftContent", () => {
  it("parses a valid runtime-shaped draft payload", () => {
    const draft = parseAuthoringGameDraftContent(createAuthoringDraft());

    expect(draft).toEqual(createAuthoringDraft());
  });

  it("rejects non-object payloads", () => {
    expect(() => parseAuthoringGameDraftContent("nope")).toThrow(
      "Draft content must be an object.",
    );
  });

  it("rejects null optional strings in the canonical draft payload", () => {
    expect(() =>
      parseAuthoringGameDraftContent({
        ...createAuthoringDraft(),
        questions: [
          {
            ...createAuthoringDraft().questions[0],
            explanation: null,
          },
        ],
      })
    ).toThrow(
      'Question "q1" explanation must be a string when provided.',
    );
  });

  it("rejects invalid scalar field types", () => {
    expect(() =>
      parseAuthoringGameDraftContent({
        ...createAuthoringDraft(),
        estimatedMinutes: "2",
      })
    ).toThrow('Draft content "estimatedMinutes" must be a positive integer.');
  });

  it("rejects invalid feedback mode values", () => {
    expect(() =>
      parseAuthoringGameDraftContent({
        ...createAuthoringDraft(),
        feedbackMode: "invalid_mode",
      })
    ).toThrow(
      'Draft content "feedbackMode" must be "final_score_reveal" or "instant_feedback_required".',
    );
  });

  it("rejects invalid question selection mode values", () => {
    expect(() =>
      parseAuthoringGameDraftContent({
        ...createAuthoringDraft(),
        questions: [
          {
            ...createAuthoringDraft().questions[0],
            selectionMode: "not-a-mode",
          },
        ],
      })
    ).toThrow('Question "q1" selection mode must be "single" or "multiple".');
  });

  it("accepts null sponsor on a question", () => {
    const draft = parseAuthoringGameDraftContent({
      ...createAuthoringDraft(),
      questions: [{ ...createAuthoringDraft().questions[0], sponsor: null }],
    });

    expect(draft.questions[0].sponsor).toBeNull();
  });

  it("accepts omitted sponsor field on a question", () => {
    const baseQuestion = createAuthoringDraft().questions[0];
    const draft = parseAuthoringGameDraftContent({
      ...createAuthoringDraft(),
      questions: [
        {
          id: baseQuestion.id,
          prompt: baseQuestion.prompt,
          selectionMode: baseQuestion.selectionMode,
          correctAnswerIds: baseQuestion.correctAnswerIds,
          options: baseQuestion.options,
        },
      ],
    });

    expect(draft.questions[0].sponsor).toBeNull();
  });

  it("rejects a non-string non-null sponsor", () => {
    expect(() =>
      parseAuthoringGameDraftContent({
        ...createAuthoringDraft(),
        questions: [{ ...createAuthoringDraft().questions[0], sponsor: 42 }],
      })
    ).toThrow('Question "q1" sponsor must be a string or null.');
  });

  it("rejects null sponsorFact in the canonical draft payload", () => {
    expect(() =>
      parseAuthoringGameDraftContent({
        ...createAuthoringDraft(),
        questions: [
          {
            ...createAuthoringDraft().questions[0],
            sponsorFact: null,
          },
        ],
      })
    ).toThrow(
      'Question "q1" sponsorFact must be a string when provided.',
    );
  });
});

describe("validateAuthoringGameDraftContent", () => {
  it("accepts a valid draft payload", () => {
    expect(() =>
      validateAuthoringGameDraftContent(createAuthoringDraft())
    ).not.toThrow();
  });

  it("rejects duplicate question ids", () => {
    const draft = createAuthoringDraft({
      questions: [
        createAuthoringDraft().questions[0],
        {
          ...createAuthoringDraft().questions[1],
          id: "q1",
        },
      ],
    });

    expect(() => validateAuthoringGameDraftContent(draft)).toThrow(
      'Duplicate question id in game "test-game": q1',
    );
  });

  it("rejects empty question arrays", () => {
    expect(() =>
      validateAuthoringGameDraftContent(
        createAuthoringDraft({
          questions: [],
        }),
      )
    ).toThrow('Game "test-game" must include at least one question.');
  });

  it("rejects invalid correct-answer ids", () => {
    const draft = createAuthoringDraft();
    draft.questions[0] = {
      ...draft.questions[0],
      correctAnswerIds: ["missing"],
    };

    expect(() => validateAuthoringGameDraftContent(draft)).toThrow(
      'Question "q1" in game "test-game" references unknown correct answer "missing".',
    );
  });

  it("rejects single-select questions with multiple correct answers", () => {
    const draft = createAuthoringDraft();
    draft.questions[0] = {
      ...draft.questions[0],
      correctAnswerIds: ["a", "b"],
    };

    expect(() => validateAuthoringGameDraftContent(draft)).toThrow(
      'Single-select question "q1" in game "test-game" must have exactly one correct answer.',
    );
  });
});

describe("mapAuthoringGameDraftContentToGameConfig", () => {
  it("preserves authored question and option order", () => {
    const draft = createAuthoringDraft({
      questions: [
        {
          ...createAuthoringDraft().questions[1],
          options: [
            { id: "c", label: "Option C" },
            { id: "a", label: "Option A" },
            { id: "b", label: "Option B" },
          ],
        },
        createAuthoringDraft().questions[0],
      ],
    });

    const game = mapAuthoringGameDraftContentToGameConfig(draft);

    expect(game.questions.map((question) => question.id)).toEqual(["q2", "q1"]);
    expect(game.questions[0].options.map((option) => option.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("clones authored question and option arrays", () => {
    const draft = createAuthoringDraft();
    const game = mapAuthoringGameDraftContentToGameConfig(draft);

    expect(game.questions).not.toBe(draft.questions);
    expect(game.questions[0].correctAnswerIds).not.toBe(
      draft.questions[0].correctAnswerIds,
    );
    expect(game.questions[0].options).not.toBe(draft.questions[0].options);
  });
});
