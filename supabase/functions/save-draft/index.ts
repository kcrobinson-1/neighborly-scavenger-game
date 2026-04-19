import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import {
  type AuthoringGameDraftContent,
  parseAuthoringGameDraftContent,
} from "../../../shared/game-config.ts";
import {
  type AuthoringHttpDependencies,
  createAuthoringPostHandler,
  defaultAuthoringHttpDependencies,
} from "../_shared/authoring-http.ts";

type DraftSaveRequestBody = {
  content: AuthoringGameDraftContent;
  eventCode: string | null;
};

type DraftSavePersistenceInput = {
  actorUserId: string;
  content: AuthoringGameDraftContent;
  eventCode: string | null;
};

type DraftSaveRow = {
  id: string;
  live_version_number: number | null;
  name: string;
  slug: string;
  updated_at: string;
};

type DraftSavePersistenceResult = {
  data: DraftSaveRow | null;
  error: { code?: string; details?: string; message: string } | null;
};

type EventCodeGenerationResult = {
  data: string | null;
  error: { code?: string; details?: string; message: string } | null;
};

type ExistingDraftRow = {
  event_code: string | null;
  live_version_number: number | null;
  slug: string;
};

const EVENT_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_EVENT_CODE_GENERATION_ATTEMPTS = 20;

export type SaveDraftHandlerDependencies = {
  authoringHttp: AuthoringHttpDependencies;
  parseAuthoringGameDraftContent: typeof parseAuthoringGameDraftContent;
  saveDraft: (
    input: DraftSavePersistenceInput,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<DraftSavePersistenceResult>;
};

function createServiceRoleClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

async function saveDraft(
  input: DraftSavePersistenceInput,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<DraftSavePersistenceResult> {
  const supabase = createServiceRoleClient(supabaseUrl, serviceRoleKey);

  const { data: existing } = await supabase
    .from("game_event_drafts")
    .select("event_code,live_version_number,slug")
    .eq("id", input.content.id)
    .maybeSingle<ExistingDraftRow>();

  if (
    existing !== null &&
    existing.live_version_number !== null &&
    existing.slug !== input.content.slug
  ) {
    return {
      data: null,
      error: {
        code: "slug_locked",
        message: "Slug cannot be changed after the event has been published.",
      },
    };
  }

  if (
    existing !== null &&
    existing.live_version_number !== null &&
    input.eventCode !== null &&
    input.eventCode !== existing.event_code
  ) {
    return {
      data: null,
      error: {
        code: "event_code_locked",
        message: "Event code cannot be changed after the event has been published.",
      },
    };
  }

  const preservedEventCode = existing?.event_code ?? null;
  const requestedEventCode = input.eventCode ?? preservedEventCode;

  if (requestedEventCode !== null) {
    return await upsertDraft(input, supabase, requestedEventCode);
  }

  for (let attempt = 0; attempt < MAX_EVENT_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const generatedEventCode = await generateRandomEventCode(supabase);

    if (generatedEventCode.error || !generatedEventCode.data) {
      return {
        data: null,
        error: generatedEventCode.error ?? {
          code: "event_code_generation_failed",
          message: "Event code generation returned an empty response.",
        },
      };
    }

    const result = await upsertDraft(input, supabase, generatedEventCode.data);

    if (!isEventCodeConflict(result.error)) {
      return result;
    }
  }

  return {
    data: null,
    error: {
      code: "event_code_exhausted",
      message: "Unable to generate an unused event code.",
    },
  };
}

async function generateRandomEventCode(
  supabase: ServiceRoleClient,
): Promise<EventCodeGenerationResult> {
  const { data, error } = await supabase.rpc("generate_random_event_code");

  if (error) {
    return { data: null, error };
  }

  if (typeof data !== "string") {
    return {
      data: null,
      error: {
        code: "event_code_generation_failed",
        message: "Event code generation returned an invalid response.",
      },
    };
  }

  return {
    data,
    error: null,
  };
}

async function upsertDraft(
  input: DraftSavePersistenceInput,
  supabase: ServiceRoleClient,
  eventCode: string,
): Promise<DraftSavePersistenceResult> {
  return await supabase
    .from("game_event_drafts")
    .upsert(
      {
        content: input.content,
        event_code: eventCode,
        id: input.content.id,
        last_saved_by: input.actorUserId,
        name: input.content.name,
        schema_version: 1,
        slug: input.content.slug,
      },
      {
        onConflict: "id",
      },
    )
    .select("id,live_version_number,name,slug,updated_at")
    .single<DraftSaveRow>();
}

export const defaultSaveDraftHandlerDependencies: SaveDraftHandlerDependencies =
  {
    authoringHttp: defaultAuthoringHttpDependencies,
    parseAuthoringGameDraftContent,
    saveDraft,
};

function isEventCodeConflict(
  error: { code?: string; details?: string; message: string } | null,
) {
  if (!error) {
    return false;
  }

  return (
    error.code === "event_code_taken" ||
    (error.code === "23505" &&
      `${error.message} ${error.details ?? ""}`.includes("event_code"))
  );
}

function isEventCodeLocked(error: { code?: string; message: string }) {
  return error.code === "event_code_locked" || error.message === "event_code_locked";
}

function isSlugLocked(error: { code?: string; message: string }) {
  // Catches both the application-layer pre-check (code: "slug_locked") and the
  // DB trigger (message: "slug_locked", code: "P0001") so the race between a
  // concurrent publish and a save cannot bypass the lock.
  return error.code === "slug_locked" || error.message === "slug_locked";
}

function getPersistenceStatus(
  error: { code?: string; details?: string; message: string },
) {
  if (isEventCodeLocked(error) || isSlugLocked(error)) {
    return 422;
  }

  if (
    isEventCodeConflict(error) ||
    error.code === "23505" ||
    error.message.includes("duplicate key")
  ) {
    return 409;
  }

  if (error.code === "event_code_exhausted") {
    return 503;
  }

  return 500;
}

function getPersistenceMessage(
  error: { code?: string; details?: string; message: string },
) {
  if (isEventCodeLocked(error)) {
    return "Event code can't change after the event is published.";
  }

  if (isSlugLocked(error)) {
    return "The slug cannot be changed after the event has been published.";
  }

  if (isEventCodeConflict(error)) {
    return "That code is already used by another event. Try a different one.";
  }

  if (getPersistenceStatus(error) === 409) {
    return "A game event already uses that slug.";
  }

  if (error.code === "event_code_exhausted") {
    return "We couldn't generate an event code right now.";
  }

  return "We couldn't save the draft right now.";
}

export function validateDraftSavePayload(
  payload: unknown,
): DraftSaveRequestBody | null {
  if (
    typeof payload !== "object" || payload === null || Array.isArray(payload)
  ) {
    return null;
  }

  if (!("content" in payload)) {
    return null;
  }

  const rawEventCode = (payload as { eventCode?: unknown }).eventCode;
  let eventCode: string | null = null;

  if (rawEventCode !== undefined && rawEventCode !== null) {
    if (typeof rawEventCode !== "string") {
      return null;
    }

    eventCode = rawEventCode.trim() || null;
  }

  return {
    content: (payload as { content: AuthoringGameDraftContent }).content,
    eventCode,
  };
}

/** Builds the request handler used by the authenticated draft-save endpoint. */
export function createSaveDraftHandler(
  dependencies: SaveDraftHandlerDependencies =
    defaultSaveDraftHandlerDependencies,
) {
  return createAuthoringPostHandler(
    dependencies.authoringHttp,
    async (request, context) => {
      const payload = validateDraftSavePayload(
        await request.json().catch(() => null),
      );

      if (!payload) {
        return context.jsonResponse(
          400,
          { error: "Invalid draft save payload." },
        );
      }

      let content: AuthoringGameDraftContent;

      try {
        content = dependencies.parseAuthoringGameDraftContent(payload.content);
      } catch (error: unknown) {
        return context.jsonResponse(
          400,
          {
            details: error instanceof Error ? error.message : undefined,
            error: "Draft content is invalid.",
          },
        );
      }

      if (
        payload.eventCode !== null &&
        !EVENT_CODE_PATTERN.test(payload.eventCode)
      ) {
        return context.jsonResponse(
          422,
          {
            details: "event_code_invalid",
            error: "Event codes are exactly 3 uppercase letters.",
          },
        );
      }

      const { data, error } = await dependencies.saveDraft(
        {
          actorUserId: context.admin.userId,
          content,
          eventCode: payload.eventCode,
        },
        context.supabaseUrl,
        context.serviceRoleKey,
      );

      // Draft table writes are service-role-owned after the admin check so the
      // browser cannot bypass normalization by writing directly through PostgREST.
      if (error || !data) {
        return context.jsonResponse(
          error ? getPersistenceStatus(error) : 500,
          {
            details: error?.message,
            error: error
              ? getPersistenceMessage(error)
              : "We couldn't save the draft right now.",
          },
        );
      }

      return context.jsonResponse(
        200,
        {
          hasBeenPublished: data.live_version_number !== null,
          id: data.id,
          liveVersionNumber: data.live_version_number,
          name: data.name,
          slug: data.slug,
          updatedAt: data.updated_at,
        },
      );
    },
  );
}

/** Saves a canonical private game draft for an authenticated admin. */
export const handleSaveDraftRequest = createSaveDraftHandler();

if (import.meta.main) {
  Deno.serve(handleSaveDraftRequest);
}
