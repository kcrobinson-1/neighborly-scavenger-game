import { validateGameConfig } from "./game-validation.ts";
import type {
  FeedbackMode,
  GameConfig,
  SelectionMode,
} from "./types.ts";

/** Published event row fetched from the quiz content tables. */
export type PublishedGameEventRow = {
  allow_back_navigation: boolean;
  allow_retake: boolean;
  estimated_minutes: number;
  feedback_mode: FeedbackMode;
  id: string;
  intro: string;
  location: string;
  name: string;
  raffle_label: string;
  slug: string;
  summary: string;
};

/** Published question row fetched from the quiz content tables. */
export type PublishedGameQuestionRow = {
  display_order: number;
  event_id: string;
  explanation: string | null;
  id: string;
  prompt: string;
  selection_mode: SelectionMode;
  sponsor: string | null;
  sponsor_fact: string | null;
};

/** Published option row fetched from the quiz content tables. */
export type PublishedGameOptionRow = {
  display_order: number;
  event_id: string;
  id: string;
  is_correct: boolean;
  label: string;
  question_id: string;
};

/** Canonical DB row bundle used to hydrate a playable quiz config. */
export type PublishedGameRows = {
  event: PublishedGameEventRow;
  options: PublishedGameOptionRow[];
  questions: PublishedGameQuestionRow[];
};

function assertRowsBelongToEvent(
  eventId: string,
  label: string,
  rows: Array<{ event_id: string; id: string }>,
) {
  const mismatchedRow = rows.find((row) => row.event_id !== eventId);

  if (mismatchedRow) {
    throw new Error(
      `${label} "${mismatchedRow.id}" does not belong to game "${eventId}".`,
    );
  }
}

/** Maps normalized published-content rows into the shared GameConfig shape. */
export function mapPublishedGameRowsToGameConfig(
  rows: PublishedGameRows,
): GameConfig {
  const { event, options, questions } = rows;

  assertRowsBelongToEvent(event.id, "Question", questions);
  assertRowsBelongToEvent(event.id, "Option", options);

  const questionIds = new Set(questions.map((question) => question.id));
  const unknownOption = options.find((option) => !questionIds.has(option.question_id));

  if (unknownOption) {
    throw new Error(
      `Game "${event.id}" includes options for unknown question "${unknownOption.question_id}".`,
    );
  }

  const sortedOptions = [...options].sort((left, right) => {
    if (left.question_id !== right.question_id) {
      return left.question_id.localeCompare(right.question_id);
    }

    return left.display_order - right.display_order;
  });

  const optionsByQuestionId = new Map<string, PublishedGameOptionRow[]>();

  for (const option of sortedOptions) {
    const questionOptions = optionsByQuestionId.get(option.question_id) ?? [];
    questionOptions.push(option);
    optionsByQuestionId.set(option.question_id, questionOptions);
  }

  const game: GameConfig = {
    allowBackNavigation: event.allow_back_navigation,
    allowRetake: event.allow_retake,
    estimatedMinutes: event.estimated_minutes,
    feedbackMode: event.feedback_mode,
    id: event.id,
    intro: event.intro,
    location: event.location,
    name: event.name,
    raffleLabel: event.raffle_label,
    slug: event.slug,
    summary: event.summary,
    questions: [...questions]
      .sort((left, right) => left.display_order - right.display_order)
      .map((question) => {
        const questionOptions = optionsByQuestionId.get(question.id) ?? [];

        if (questionOptions.length === 0) {
          throw new Error(
            `Question "${question.id}" in game "${event.id}" must include at least one option.`,
          );
        }

        return {
          id: question.id,
          sponsor: question.sponsor,
          prompt: question.prompt,
          selectionMode: question.selection_mode,
          correctAnswerIds: questionOptions
            .filter((option) => option.is_correct)
            .map((option) => option.id),
          explanation: question.explanation ?? undefined,
          sponsorFact: question.sponsor_fact ?? undefined,
          options: questionOptions
            .sort((left, right) => left.display_order - right.display_order)
            .map((option) => ({
              id: option.id,
              label: option.label,
            })),
        };
      }),
  };

  validateGameConfig(game);
  return game;
}
