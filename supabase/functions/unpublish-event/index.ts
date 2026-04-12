import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import {
  type AuthoringHttpDependencies,
  createAuthoringPostHandler,
  defaultAuthoringHttpDependencies,
} from "../_shared/authoring-http.ts";

type UnpublishEventRequestBody = {
  eventId: string;
};

type UnpublishRpcRow = {
  event_id: string;
  unpublished_at: string;
};

type SupabasePersistenceResult<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
};

export type UnpublishEventHandlerDependencies = {
  authoringHttp: AuthoringHttpDependencies;
  unpublishEvent: (
    eventId: string,
    actorUserId: string,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<SupabasePersistenceResult<UnpublishRpcRow>>;
};

async function unpublishEvent(
  eventId: string,
  actorUserId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<SupabasePersistenceResult<UnpublishRpcRow>> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return await supabase
    .rpc("unpublish_quiz_event", {
      p_actor_id: actorUserId,
      p_event_id: eventId,
    })
    .single<UnpublishRpcRow>();
}

export const defaultUnpublishEventHandlerDependencies:
  UnpublishEventHandlerDependencies = {
    authoringHttp: defaultAuthoringHttpDependencies,
    unpublishEvent,
  };

function getPersistenceStatus(error: { code?: string; message: string }) {
  if (
    error.code === "PGRST116" ||
    error.message === "draft_not_found" ||
    error.message === "live_event_not_found"
  ) {
    return 400;
  }

  return 500;
}

function getPersistenceMessage(error: { code?: string; message: string }) {
  if (getPersistenceStatus(error) === 400) {
    return "This quiz event is not live.";
  }

  return "We couldn't unpublish the event right now.";
}

export function validateUnpublishEventPayload(
  payload: unknown,
): UnpublishEventRequestBody | null {
  if (
    typeof payload !== "object" || payload === null || Array.isArray(payload)
  ) {
    return null;
  }

  const eventId =
    typeof (payload as Partial<UnpublishEventRequestBody>).eventId === "string"
      ? (payload as Partial<UnpublishEventRequestBody>).eventId?.trim()
      : "";

  if (!eventId) {
    return null;
  }

  return {
    eventId,
  };
}

/** Builds the request handler used by the authenticated unpublish endpoint. */
export function createUnpublishEventHandler(
  dependencies: UnpublishEventHandlerDependencies =
    defaultUnpublishEventHandlerDependencies,
) {
  return createAuthoringPostHandler(
    dependencies.authoringHttp,
    async (request, context) => {
      const payload = validateUnpublishEventPayload(
        await request.json().catch(() => null),
      );

      if (!payload) {
        return context.jsonResponse(
          400,
          { error: "Invalid unpublish payload." },
        );
      }

      const { data, error } = await dependencies.unpublishEvent(
        payload.eventId,
        context.admin.userId,
        context.supabaseUrl,
        context.serviceRoleKey,
      );

      if (error || !data) {
        const persistenceError = error ?? {
          message: "Unpublish returned no result.",
        };

        return context.jsonResponse(
          getPersistenceStatus(persistenceError),
          {
            details: persistenceError.message,
            error: getPersistenceMessage(persistenceError),
          },
        );
      }

      return context.jsonResponse(
        200,
        {
          eventId: data.event_id,
          unpublishedAt: data.unpublished_at,
        },
      );
    },
  );
}

/** Unpublishes a live quiz event for an authenticated admin. */
export const handleUnpublishEventRequest = createUnpublishEventHandler();

if (import.meta.main) {
  Deno.serve(handleUnpublishEventRequest);
}
