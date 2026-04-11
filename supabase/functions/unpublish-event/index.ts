import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import { authenticateQuizAdmin, type AdminAuthResult } from "../_shared/admin-auth.ts";
import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";

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
  authenticateQuizAdmin: (
    request: Request,
    supabaseUrl: string,
    serviceRoleKey: string,
    supabaseClientKey: string,
  ) => Promise<AdminAuthResult>;
  createCorsHeaders: typeof createCorsHeaders;
  getAllowedOrigin: typeof getAllowedOrigin;
  getServiceRoleKey: () => string | undefined;
  getSupabaseClientKey: () => string | undefined;
  getSupabaseUrl: () => string | undefined;
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

export const defaultUnpublishEventHandlerDependencies: UnpublishEventHandlerDependencies = {
  authenticateQuizAdmin,
  createCorsHeaders,
  getAllowedOrigin,
  getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  getSupabaseClientKey: () =>
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY"),
  getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
  unpublishEvent,
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  createHeaders: UnpublishEventHandlerDependencies["createCorsHeaders"],
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...createHeaders(origin),
      "Content-Type": "application/json",
    },
    status,
  });
}

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
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
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
  dependencies: UnpublishEventHandlerDependencies = defaultUnpublishEventHandlerDependencies,
) {
  return async (request: Request) => {
    const origin = dependencies.getAllowedOrigin(request);

    if (!origin) {
      return jsonResponse(403, { error: "Origin not allowed." }, null, dependencies.createCorsHeaders);
    }

    if (request.method === "OPTIONS") {
      return new Response("ok", {
        headers: dependencies.createCorsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        405,
        { error: "Method not allowed." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const supabaseUrl = dependencies.getSupabaseUrl();
    const serviceRoleKey = dependencies.getServiceRoleKey();
    const supabaseClientKey = dependencies.getSupabaseClientKey();

    if (!supabaseUrl || !serviceRoleKey || !supabaseClientKey) {
      return jsonResponse(
        500,
        { error: "Server-side authoring configuration is missing." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const admin = await dependencies.authenticateQuizAdmin(
      request,
      supabaseUrl,
      serviceRoleKey,
      supabaseClientKey,
    );

    if (admin.status !== "ok") {
      return jsonResponse(
        admin.status === "unauthenticated" ? 401 : 403,
        { error: admin.error },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const payload = validateUnpublishEventPayload(await request.json().catch(() => null));

    if (!payload) {
      return jsonResponse(
        400,
        { error: "Invalid unpublish payload." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const { data, error } = await dependencies.unpublishEvent(
      payload.eventId,
      admin.userId,
      supabaseUrl,
      serviceRoleKey,
    );

    if (error || !data) {
      const persistenceError = error ?? {
        message: "Unpublish returned no result.",
      };

      return jsonResponse(
        getPersistenceStatus(persistenceError),
        {
          details: persistenceError.message,
          error: getPersistenceMessage(persistenceError),
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    return jsonResponse(
      200,
      {
        eventId: data.event_id,
        unpublishedAt: data.unpublished_at,
      },
      origin,
      dependencies.createCorsHeaders,
    );
  };
}

/** Unpublishes a live quiz event for an authenticated admin. */
export const handleUnpublishEventRequest = createUnpublishEventHandler();

if (import.meta.main) {
  Deno.serve(handleUnpublishEventRequest);
}
