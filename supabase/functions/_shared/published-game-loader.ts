import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  mapPublishedGameRowsToGameConfig,
  type GameConfig,
  type PublishedGameEventRow,
  type PublishedGameOptionRow,
  type PublishedGameQuestionRow,
} from "../../../shared/game-config.ts";

const publishedGameEventColumns = [
  "id",
  "slug",
  "name",
  "location",
  "estimated_minutes",
  "raffle_label",
  "intro",
  "summary",
  "feedback_mode",
  "allow_back_navigation",
  "allow_retake",
].join(", ");

const publishedGameQuestionColumns = [
  "event_id",
  "id",
  "display_order",
  "sponsor",
  "prompt",
  "selection_mode",
  "explanation",
  "sponsor_fact",
].join(", ");

const publishedGameOptionColumns = [
  "event_id",
  "question_id",
  "id",
  "display_order",
  "label",
  "is_correct",
].join(", ");

/** Loads one published quiz by its event id and maps it into the shared domain model. */
export async function loadPublishedGameById(
  eventId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<GameConfig | null> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: eventRow, error: eventError } = await supabase
    .from("quiz_events")
    .select(publishedGameEventColumns)
    .eq("id", eventId)
    .not("published_at", "is", null)
    .maybeSingle<PublishedGameEventRow>();

  if (eventError) {
    throw new Error(
      `Failed to load published quiz event "${eventId}": ${eventError.message}`,
    );
  }

  if (!eventRow) {
    return null;
  }

  const [
    { data: questionRows, error: questionError },
    { data: optionRows, error: optionError },
  ] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select(publishedGameQuestionColumns)
      .eq("event_id", eventId)
      .order("display_order", { ascending: true })
      .returns<PublishedGameQuestionRow[]>(),
    supabase
      .from("quiz_question_options")
      .select(publishedGameOptionColumns)
      .eq("event_id", eventId)
      .order("question_id", { ascending: true })
      .order("display_order", { ascending: true })
      .returns<PublishedGameOptionRow[]>(),
  ]);

  if (questionError) {
    throw new Error(
      `Failed to load published quiz questions for "${eventId}": ${questionError.message}`,
    );
  }

  if (optionError) {
    throw new Error(
      `Failed to load published quiz options for "${eventId}": ${optionError.message}`,
    );
  }

  try {
    return mapPublishedGameRowsToGameConfig({
      event: eventRow,
      options: optionRows ?? [],
      questions: questionRows ?? [],
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error
        ? `Published quiz event "${eventId}" is malformed: ${error.message}`
        : `Published quiz event "${eventId}" is malformed.`,
    );
  }
}
