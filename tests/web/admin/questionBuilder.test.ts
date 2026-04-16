import { describe, expect, it } from "vitest";
import { getGameById } from "../../../shared/game-config/sample-fixtures";
import {
  addOption,
  addQuestion,
  applyQuestionFormValues,
  createQuestionFormValues,
  deleteOption,
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  prepareQuestionContentForSave,
  updateQuestionSelectionMode,
} from "../../../apps/web/src/admin/questionBuilder";
import { validateAuthoringGameDraftContent } from "../../../shared/game-config";

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

  it("maps a null sponsor to an empty string in form values", () => {
    const gameWithUnsponsoredQuestion = {
      ...sampleGame,
      questions: [{ ...sampleQuestion, sponsor: null }],
    };
    const values = createQuestionFormValues(
      gameWithUnsponsoredQuestion,
      sampleQuestion.id,
    );

    expect(values.sponsor).toBe("");
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

  it("saves null sponsor when the sponsor field is blank", () => {
    const nextContent = applyQuestionFormValues(sampleGame, sampleQuestion.id, {
      ...createQuestionFormValues(sampleGame, sampleQuestion.id),
      sponsor: " ",
    });

    expect(nextContent.questions[0].sponsor).toBeNull();
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

describe("question structure helpers", () => {
  it("adds a valid placeholder question with the first available question id", () => {
    const { content, focusedQuestionId } = addQuestion(sampleGame);

    expect(focusedQuestionId).toBe("q7");
    expect(content.questions).toHaveLength(sampleGame.questions.length + 1);
    expect(content.questions.at(-1)).toMatchObject({
      correctAnswerIds: ["a"],
      id: "q7",
      options: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" },
      ],
      prompt: "New question",
      selectionMode: "single",
      sponsor: "New sponsor",
    });
    expect(() => validateAuthoringGameDraftContent(content)).not.toThrow();
  });

  it("duplicates a question after the source with a new question id", () => {
    const { content, focusedQuestionId } = duplicateQuestion(
      sampleGame,
      sampleQuestion.id,
    );

    expect(focusedQuestionId).toBe("q7");
    expect(content.questions.map((question) => question.id).slice(0, 3)).toEqual([
      sampleQuestion.id,
      "q7",
      sampleGame.questions[1].id,
    ]);
    expect(content.questions[1]).toMatchObject({
      ...sampleQuestion,
      id: "q7",
      prompt: `${sampleQuestion.prompt} Copy`,
    });
    expect(content.questions[1].options).toEqual(sampleQuestion.options);
    expect(() => validateAuthoringGameDraftContent(content)).not.toThrow();
  });

  it("moves questions one position at a time without changing question content", () => {
    const movedDown = moveQuestion(sampleGame, sampleQuestion.id, "down");
    const movedBackUp = moveQuestion(
      movedDown.content,
      movedDown.focusedQuestionId,
      "up",
    );

    expect(movedDown.focusedQuestionId).toBe(sampleQuestion.id);
    expect(movedDown.content.questions[1]).toEqual(sampleQuestion);
    expect(movedBackUp.content.questions).toEqual(sampleGame.questions);
  });

  it("deletes questions with next-question focus and rejects deleting the final question", () => {
    const { content, focusedQuestionId } = deleteQuestion(
      sampleGame,
      sampleQuestion.id,
    );

    expect(focusedQuestionId).toBe(sampleGame.questions[1].id);
    expect(content.questions.map((question) => question.id)).not.toContain(
      sampleQuestion.id,
    );
    expect(() =>
      deleteQuestion(
        {
          ...sampleGame,
          questions: [sampleQuestion],
        },
        sampleQuestion.id,
      ),
    ).toThrow("Keep at least one question.");
  });

  it("adds answer options with generated ids and keeps current correct answers", () => {
    const content = addOption(sampleGame, sampleQuestion.id);
    const nextQuestion = content.questions[0];

    expect(nextQuestion.options.at(-1)).toEqual({
      id: "d",
      label: "New option",
    });
    expect(nextQuestion.correctAnswerIds).toEqual(sampleQuestion.correctAnswerIds);
    expect(() => validateAuthoringGameDraftContent(content)).not.toThrow();
  });

  it("falls back to option-N ids after single-letter option ids are exhausted", () => {
    const alphabetQuestion = {
      ...sampleQuestion,
      correctAnswerIds: ["a"],
      options: Array.from({ length: 26 }, (_, index) => ({
        id: String.fromCharCode(97 + index),
        label: `Option ${index + 1}`,
      })),
    };
    const content = addOption(
      {
        ...sampleGame,
        questions: [alphabetQuestion],
      },
      alphabetQuestion.id,
    );

    expect(content.questions[0].options.at(-1)).toEqual({
      id: "option-1",
      label: "New option",
    });
  });

  it("deletes answer options and repairs correct answers", () => {
    const content = deleteOption(sampleGame, sampleQuestion.id, "a");
    const nextQuestion = content.questions[0];

    expect(nextQuestion.options.map((option) => option.id)).not.toContain("a");
    expect(nextQuestion.correctAnswerIds).toEqual(["b"]);
    expect(() => validateAuthoringGameDraftContent(content)).not.toThrow();
  });

  it("rejects deleting the final answer option", () => {
    expect(() =>
      deleteOption(
        {
          ...sampleGame,
          questions: [
            {
              ...sampleQuestion,
              correctAnswerIds: ["a"],
              options: [{ id: "a", label: "Only option" }],
            },
          ],
        },
        sampleQuestion.id,
        "a",
      ),
    ).toThrow("Keep at least one answer option.");
  });

  it("repairs correct answers when selection mode changes", () => {
    const multipleQuestion = {
      ...sampleQuestion,
      correctAnswerIds: ["a", "b"],
      selectionMode: "multiple" as const,
    };
    const singleContent = updateQuestionSelectionMode(
      {
        ...sampleGame,
        questions: [multipleQuestion],
      },
      multipleQuestion.id,
      "single",
    );
    const multipleContent = updateQuestionSelectionMode(
      {
        ...sampleGame,
        questions: [
          {
            ...sampleQuestion,
            correctAnswerIds: [],
            selectionMode: "single",
          },
        ],
      },
      sampleQuestion.id,
      "multiple",
    );

    expect(singleContent.questions[0].correctAnswerIds).toEqual(["a"]);
    expect(multipleContent.questions[0].correctAnswerIds).toEqual(["a"]);
    expect(() => validateAuthoringGameDraftContent(singleContent)).not.toThrow();
    expect(() => validateAuthoringGameDraftContent(multipleContent)).not.toThrow();
  });

  it("prepares edited content for save by trimming fields and validating shape", () => {
    const content = prepareQuestionContentForSave({
      ...sampleGame,
      questions: [
        {
          ...sampleQuestion,
          explanation: " ",
          options: sampleQuestion.options.map((option) => ({
            ...option,
            label: ` ${option.label} `,
          })),
          prompt: ` ${sampleQuestion.prompt} `,
          sponsor: ` ${sampleQuestion.sponsor} `,
          sponsorFact: " ",
        },
      ],
    });

    expect(content.questions[0].prompt).toBe(sampleQuestion.prompt);
    expect(content.questions[0].sponsor).toBe(sampleQuestion.sponsor);
    expect(content.questions[0].explanation).toBeUndefined();
    expect(content.questions[0].sponsorFact).toBeUndefined();
    expect(content.questions[0].options).toEqual(sampleQuestion.options);
  });
});
