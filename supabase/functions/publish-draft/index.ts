import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import {
  parseAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
} from "../../../shared/game-config.ts";
import { authenticateQuizAdmin, type AdminAuthResult } from "../_shared/admin-auth.ts";
import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";

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

export const defaultPublishDraftHandlerDependencies: PublishDraftHandlerDependencies = {
  authenticateQuizAdmin,
  createCorsHeaders,
  getAllowedOrigin,
  getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  getSupabaseClientKey: () =>
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY"),
  getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
  loadDraft,
  parseAuthoringGameDraftContent,
  publishDraft,
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  createHeaders: PublishDraftHandlerDependencies["createCorsHeaders"],
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

export function validatePublishDraftPayload(payload: unknown): PublishDraftRequestBody | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
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
  dependencies: PublishDraftHandlerDependencies = defaultPublishDraftHandlerDependencies,
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

    const payload = validatePublishDraftPayload(await request.json().catch(() => null));

    if (!payload) {
      return jsonResponse(
        400,
        { error: "Invalid publish payload." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    const draft = await dependencies.loadDraft(
      payload.eventId,
      supabaseUrl,
      serviceRoleKey,
    );

    if (draft.error) {
      return jsonResponse(
        getPersistenceStatus(draft.error),
        {
          details: draft.error.message,
          error: getPersistenceMessage(draft.error),
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    if (!draft.data) {
      return jsonResponse(
        400,
        { error: "Draft content is invalid.", details: "draft_not_found" },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    let content: AuthoringGameDraftContent;

    try {
      content = dependencies.parseAuthoringGameDraftContent(draft.data.content);
    } catch (error: unknown) {
      return jsonResponse(
        400,
        {
          details: error instanceof Error ? error.message : undefined,
          error: "Draft content is invalid.",
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    if (
      content.id !== draft.data.id ||
      content.slug !== draft.data.slug ||
      content.name !== draft.data.name
    ) {
      return jsonResponse(
        400,
        {
          details: "invalid_draft_identity",
          error: "Draft content is invalid.",
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    // Validate in TypeScript before invoking the SQL transition so invalid
    // drafts fail before the live projection transaction starts.
    const publish = await dependencies.publishDraft(
      payload.eventId,
      admin.userId,
      supabaseUrl,
      serviceRoleKey,
    );

    if (publish.error || !publish.data) {
      const error = publish.error ?? {
        message: "Publish returned no result.",
      };

      return jsonResponse(
        getPersistenceStatus(error),
        {
          details: error.message,
          error: getPersistenceMessage(error),
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    return jsonResponse(
      200,
      {
        eventId: publish.data.event_id,
        publishedAt: publish.data.published_at,
        slug: publish.data.slug,
        versionNumber: publish.data.version_number,
      },
      origin,
      dependencies.createCorsHeaders,
    );
  };
}

/** Publishes a private draft into the public quiz projection for an admin. */
export const handlePublishDraftRequest = createPublishDraftHandler();

if (import.meta.main) {
  Deno.serve(handlePublishDraftRequest);
}
