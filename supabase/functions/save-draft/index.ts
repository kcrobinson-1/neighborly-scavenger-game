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
};

type DraftSavePersistenceInput = {
  actorUserId: string;
  content: AuthoringGameDraftContent;
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
  error: { code?: string; message: string } | null;
};

export type SaveDraftHandlerDependencies = {
  authoringHttp: AuthoringHttpDependencies;
  parseAuthoringGameDraftContent: typeof parseAuthoringGameDraftContent;
  saveDraft: (
    input: DraftSavePersistenceInput,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<DraftSavePersistenceResult>;
};

async function saveDraft(
  input: DraftSavePersistenceInput,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<DraftSavePersistenceResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: existing } = await supabase
    .from("quiz_event_drafts")
    .select("live_version_number, slug")
    .eq("id", input.content.id)
    .maybeSingle<{ live_version_number: number | null; slug: string }>();

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

  return await supabase
    .from("quiz_event_drafts")
    .upsert(
      {
        content: input.content,
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

function getPersistenceStatus(error: { code?: string; message: string }) {
  // Catches both the application-layer pre-check (code: "slug_locked") and the
  // DB trigger (message: "slug_locked", code: "P0001") so the race between a
  // concurrent publish and a save cannot bypass the lock.
  if (error.code === "slug_locked" || error.message === "slug_locked") {
    return 422;
  }

  if (error.code === "23505" || error.message.includes("duplicate key")) {
    return 409;
  }

  return 500;
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

  return {
    content: (payload as { content: AuthoringGameDraftContent }).content,
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

      const { data, error } = await dependencies.saveDraft(
        {
          actorUserId: context.admin.userId,
          content,
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
            error: error && getPersistenceStatus(error) === 422
              ? "The slug cannot be changed after the event has been published."
              : error && getPersistenceStatus(error) === 409
              ? "A quiz event already uses that slug."
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

/** Saves a canonical private quiz draft for an authenticated admin. */
export const handleSaveDraftRequest = createSaveDraftHandler();

if (import.meta.main) {
  Deno.serve(handleSaveDraftRequest);
}
