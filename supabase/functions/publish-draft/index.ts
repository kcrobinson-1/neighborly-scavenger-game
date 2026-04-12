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

type PublishDraftRequestBody = {
  eventId: string;
};

type DraftContentRow = {
  content: AuthoringGameDraftContent;
  id: string;
  name: string;
  slug: string;
};

type PublishRpcRow = {
  event_id: string;
  published_at: string;
  slug: string;
  version_number: number;
};

type SupabasePersistenceResult<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
};

export type PublishDraftHandlerDependencies = {
  authoringHttp: AuthoringHttpDependencies;
  loadDraft: (
    eventId: string,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<SupabasePersistenceResult<DraftContentRow>>;
  parseAuthoringGameDraftContent: typeof parseAuthoringGameDraftContent;
  publishDraft: (
    eventId: string,
    actorUserId: string,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<SupabasePersistenceResult<PublishRpcRow>>;
};

async function loadDraft(
  eventId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<SupabasePersistenceResult<DraftContentRow>> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return await supabase
    .from("quiz_event_drafts")
    .select("content,id,name,slug")
    .eq("id", eventId)
    .maybeSingle<DraftContentRow>();
}

async function publishDraft(
  eventId: string,
  actorUserId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<SupabasePersistenceResult<PublishRpcRow>> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return await supabase
    .rpc("publish_quiz_event_draft", {
      p_event_id: eventId,
      p_published_by: actorUserId,
    })
    .single<PublishRpcRow>();
}

export const defaultPublishDraftHandlerDependencies:
  PublishDraftHandlerDependencies = {
    authoringHttp: defaultAuthoringHttpDependencies,
    loadDraft,
    parseAuthoringGameDraftContent,
    publishDraft,
  };

function getPersistenceStatus(error: { code?: string; message: string }) {
  if (error.code === "PGRST116" || error.message === "draft_not_found") {
    return 400;
  }

  if (error.code === "23505" || error.message === "slug_collision") {
    return 409;
  }

  if (error.message === "invalid_draft_identity") {
    return 400;
  }

  return 500;
}

function getPersistenceMessage(error: { code?: string; message: string }) {
  const status = getPersistenceStatus(error);

  if (status === 409) {
    return "A quiz event already uses that slug.";
  }

  if (status === 400) {
    return "Draft content is invalid.";
  }

  return "We couldn't publish the draft right now.";
}

export function validatePublishDraftPayload(
  payload: unknown,
): PublishDraftRequestBody | null {
  if (
    typeof payload !== "object" || payload === null || Array.isArray(payload)
  ) {
    return null;
  }

  const eventId =
    typeof (payload as Partial<PublishDraftRequestBody>).eventId === "string"
      ? (payload as Partial<PublishDraftRequestBody>).eventId?.trim()
      : "";

  if (!eventId) {
    return null;
  }

  return {
    eventId,
  };
}

/** Builds the request handler used by the authenticated publish endpoint. */
export function createPublishDraftHandler(
  dependencies: PublishDraftHandlerDependencies =
    defaultPublishDraftHandlerDependencies,
) {
  return createAuthoringPostHandler(
    dependencies.authoringHttp,
    async (request, context) => {
      const payload = validatePublishDraftPayload(
        await request.json().catch(() => null),
      );

      if (!payload) {
        return context.jsonResponse(
          400,
          { error: "Invalid publish payload." },
        );
      }

      const draft = await dependencies.loadDraft(
        payload.eventId,
        context.supabaseUrl,
        context.serviceRoleKey,
      );

      if (draft.error) {
        return context.jsonResponse(
          getPersistenceStatus(draft.error),
          {
            details: draft.error.message,
            error: getPersistenceMessage(draft.error),
          },
        );
      }

      if (!draft.data) {
        return context.jsonResponse(
          400,
          { error: "Draft content is invalid.", details: "draft_not_found" },
        );
      }

      let content: AuthoringGameDraftContent;

      try {
        content = dependencies.parseAuthoringGameDraftContent(
          draft.data.content,
        );
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
        content.id !== draft.data.id ||
        content.slug !== draft.data.slug ||
        content.name !== draft.data.name
      ) {
        return context.jsonResponse(
          400,
          {
            details: "invalid_draft_identity",
            error: "Draft content is invalid.",
          },
        );
      }

      // Validate in TypeScript before invoking the SQL transition so invalid
      // drafts fail before the live projection transaction starts.
      const publish = await dependencies.publishDraft(
        payload.eventId,
        context.admin.userId,
        context.supabaseUrl,
        context.serviceRoleKey,
      );

      if (publish.error || !publish.data) {
        const error = publish.error ?? {
          message: "Publish returned no result.",
        };

        return context.jsonResponse(
          getPersistenceStatus(error),
          {
            details: error.message,
            error: getPersistenceMessage(error),
          },
        );
      }

      return context.jsonResponse(
        200,
        {
          eventId: publish.data.event_id,
          publishedAt: publish.data.published_at,
          slug: publish.data.slug,
          versionNumber: publish.data.version_number,
        },
      );
    },
  );
}

/** Publishes a private draft into the public quiz projection for an admin. */
export const handlePublishDraftRequest = createPublishDraftHandler();

if (import.meta.main) {
  Deno.serve(handlePublishDraftRequest);
}
