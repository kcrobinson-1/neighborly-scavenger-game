import { describe, expect, it } from "vitest";
import {
  mapPublishedGameRowsToGameConfig,
  type PublishedGameEventRow,
  type PublishedGameOptionRow,
  type PublishedGameQuestionRow,
} from "../../../shared/game-config.ts";

function createEventRow(
  overrides: Partial<PublishedGameEventRow> = {},
): PublishedGameEventRow {
  return {
    allow_back_navigation: true,
    allow_retake: true,
    estimated_minutes: 2,
    feedback_mode: "final_score_reveal",
    id: "test-event",
    intro: "Test intro",
    location: "Seattle",
    name: "Test Event",
    raffle_label: "raffle ticket",
    slug: "test-event",
    summary: "Test summary",
    ...overrides,
  };
}

function createQuestionRows(
  overrides: Partial<PublishedGameQuestionRow>[] = [],
): PublishedGameQuestionRow[] {
  const questions: PublishedGameQuestionRow[] = [
    {
      display_order: 2,
      event_id: "test-event",
      explanation: null,
      id: "q2",
      prompt: "Question two?",
      selection_mode: "multiple",
      sponsor: "Sponsor Two",
      sponsor_fact: "Fact two.",
    },
    {
      display_order: 1,
      event_id: "test-event",
      explanation: "Explanation one.",
      id: "q1",
      prompt: "Question one?",
      selection_mode: "single",
      sponsor: "Sponsor One",
      sponsor_fact: null,
    },
  ];

  return questions.map((question, index) => ({
    ...question,
    ...overrides[index],
  }));
}

function createOptionRows(
  overrides: Partial<PublishedGameOptionRow>[] = [],
): PublishedGameOptionRow[] {
  const options: PublishedGameOptionRow[] = [
    {
      display_order: 2,
      event_id: "test-event",
      id: "b",
      is_correct: true,
      label: "Option B",
      question_id: "q1",
    },
    {
      display_order: 1,
      event_id: "test-event",
      id: "a",
      is_correct: false,
      label: "Option A",
      question_id: "q1",
    },
    {
      display_order: 2,
      event_id: "test-event",
      id: "c",
      is_correct: true,
      label: "Option C",
      question_id: "q2",
    },
    {
      display_order: 1,
      event_id: "test-event",
      id: "a",
      is_correct: true,
      label: "Option A",
      question_id: "q2",
    },
  ];

  return options.map((option, index) => ({
    ...option,
    ...overrides[index],
  }));
}

describe("mapPublishedGameRowsToGameConfig", () => {
  it("maps published rows into an ordered GameConfig with derived correct answers", () => {
    const game = mapPublishedGameRowsToGameConfig({
      event: createEventRow(),
      options: createOptionRows(),
      questions: createQuestionRows(),
    });

    expect(game).toEqual({
      allowBackNavigation: true,
      allowRetake: true,
      estimatedMinutes: 2,
      feedbackMode: "final_score_reveal",
      id: "test-event",
      intro: "Test intro",
      location: "Seattle",
      name: "Test Event",
      raffleLabel: "raffle ticket",
      slug: "test-event",
      summary: "Test summary",
      questions: [
        {
          id: "q1",
          sponsor: "Sponsor One",
          prompt: "Question one?",
          selectionMode: "single",
          correctAnswerIds: ["b"],
          explanation: "Explanation one.",
          options: [
            { id: "a", label: "Option A" },
            { id: "b", label: "Option B" },
          ],
        },
        {
          id: "q2",
          sponsor: "Sponsor Two",
          prompt: "Question two?",
          selectionMode: "multiple",
          correctAnswerIds: ["a", "c"],
          sponsorFact: "Fact two.",
          options: [
            { id: "a", label: "Option A" },
            { id: "c", label: "Option C" },
          ],
        },
      ],
    });
  });

  it("rejects option rows that point at an unknown question id", () => {
    expect(() =>
      mapPublishedGameRowsToGameConfig({
        event: createEventRow(),
        options: [
          ...createOptionRows(),
          {
            display_order: 1,
            event_id: "test-event",
            id: "z",
            is_correct: false,
            label: "Option Z",
            question_id: "missing-question",
          },
        ],
        questions: createQuestionRows(),
      })
    ).toThrow(
      'Game "test-event" includes options for unknown question "missing-question".',
    );
  });

  it("rejects question rows from a different event id", () => {
    expect(() =>
      mapPublishedGameRowsToGameConfig({
        event: createEventRow(),
        options: createOptionRows(),
        questions: createQuestionRows([{ event_id: "other-event" }]),
      })
    ).toThrow('Question "q2" does not belong to game "test-event".');
  });

  it("rejects rows that map into an invalid game config", () => {
    expect(() =>
      mapPublishedGameRowsToGameConfig({
        event: createEventRow(),
        options: createOptionRows([
          { is_correct: false },
          { is_correct: false },
        ]),
        questions: createQuestionRows(),
      })
    ).toThrow(
      'Question "q1" in game "test-event" must include at least one correct answer.',
    );
  });
});
