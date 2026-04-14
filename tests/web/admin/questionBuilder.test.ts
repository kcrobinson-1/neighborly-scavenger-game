import { describe, expect, it } from "vitest";
import { getGameById } from "../../../shared/game-config/sample-fixtures";
import {
  applyQuestionFormValues,
  createQuestionFormValues,
} from "../../../apps/web/src/admin/questionBuilder";

const sampleGame = getGameById("madrona-music-2026");

if (!sampleGame) {
  throw new Error("Expected the Madrona sample game to exist.");
}

const sampleQuestion = sampleGame.questions[0];

describe("createQuestionFormValues", () => {
  it("maps canonical question content into form values", () => {
    const values = createQuestionFormValues(sampleGame, sampleQuestion.id);

    expect(values).toMatchObject({
      correctAnswerIds: sampleQuestion.correctAnswerIds,
      explanation: sampleQuestion.explanation ?? "",
      options: sampleQuestion.options.map((option) => ({
        id: option.id,
        isCorrect: sampleQuestion.correctAnswerIds.includes(option.id),
        label: option.label,
      })),
      prompt: sampleQuestion.prompt,
      selectionMode: sampleQuestion.selectionMode,
      sponsor: sampleQuestion.sponsor,
      sponsorFact: sampleQuestion.sponsorFact ?? "",
    });
  });
});

describe("applyQuestionFormValues", () => {
  it("applies trimmed question edits and preserves event and structure fields", () => {
    const nextContent = applyQuestionFormValues(sampleGame, sampleQuestion.id, {
      ...createQuestionFormValues(sampleGame, sampleQuestion.id),
      explanation: " Updated explanation ",
      options: createQuestionFormValues(sampleGame, sampleQuestion.id).options.map(
        (option, index) => ({
          ...option,
          isCorrect: index === 1,
          label: ` Updated option ${index + 1} `,
        }),
      ),
      prompt: " Updated prompt ",
      selectionMode: "single",
      sponsor: " Updated sponsor ",
      sponsorFact: " Updated sponsor fact ",
    });

    expect(nextContent.id).toBe(sampleGame.id);
    expect(nextContent.slug).toBe(sampleGame.slug);
    expect(nextContent.name).toBe(sampleGame.name);
    expect(nextContent.questions).toHaveLength(sampleGame.questions.length);
    expect(nextContent.questions.map((question) => question.id)).toEqual(
      sampleGame.questions.map((question) => question.id),
    );
    expect(nextContent.questions[0]).toMatchObject({
      correctAnswerIds: [sampleQuestion.options[1].id],
      explanation: "Updated explanation",
      prompt: "Updated prompt",
      selectionMode: "single",
      sponsor: "Updated sponsor",
      sponsorFact: "Updated sponsor fact",
    });
    expect(nextContent.questions[0].options).toEqual(
      sampleQuestion.options.map((option, index) => ({
        id: option.id,
        label: `Updated option ${index + 1}`,
      })),
    );
    expect(nextContent.questions.slice(1)).toEqual(sampleGame.questions.slice(1));
  });

  it("omits optional explanation and sponsor fact when cleared", () => {
    const nextContent = applyQuestionFormValues(sampleGame, sampleQuestion.id, {
      ...createQuestionFormValues(sampleGame, sampleQuestion.id),
      explanation: " ",
      sponsorFact: " ",
    });

    expect(nextContent.questions[0].explanation).toBeUndefined();
    expect(nextContent.questions[0].sponsorFact).toBeUndefined();
  });

  it("rejects blank required question fields", () => {
    expect(() =>
      applyQuestionFormValues(sampleGame, sampleQuestion.id, {
        ...createQuestionFormValues(sampleGame, sampleQuestion.id),
        prompt: " ",
      }),
    ).toThrow("Question prompt is required.");
  });

  it("rejects blank option labels", () => {
    expect(() =>
      applyQuestionFormValues(sampleGame, sampleQuestion.id, {
        ...createQuestionFormValues(sampleGame, sampleQuestion.id),
        options: createQuestionFormValues(sampleGame, sampleQuestion.id).options.map(
          (option, index) => ({
            ...option,
            label: index === 0 ? " " : option.label,
          }),
        ),
      }),
    ).toThrow("Option a label is required.");
  });

  it("rejects invalid correct-answer selections", () => {
    expect(() =>
      applyQuestionFormValues(sampleGame, sampleQuestion.id, {
        ...createQuestionFormValues(sampleGame, sampleQuestion.id),
        options: createQuestionFormValues(sampleGame, sampleQuestion.id).options.map(
          (option) => ({
            ...option,
            isCorrect: false,
          }),
        ),
      }),
    ).toThrow("Choose at least one correct answer.");

    expect(() =>
      applyQuestionFormValues(sampleGame, sampleQuestion.id, {
        ...createQuestionFormValues(sampleGame, sampleQuestion.id),
        options: createQuestionFormValues(sampleGame, sampleQuestion.id).options.map(
          (option) => ({
            ...option,
            isCorrect: true,
          }),
        ),
        selectionMode: "single",
      }),
    ).toThrow("Single-select questions need exactly one correct answer.");

    expect(() =>
      applyQuestionFormValues(sampleGame, sampleQuestion.id, {
        ...createQuestionFormValues(sampleGame, sampleQuestion.id),
        correctAnswerIds: ["missing-option"],
      }),
    ).toThrow('Correct answer "missing-option" is not an option.');
  });
});
