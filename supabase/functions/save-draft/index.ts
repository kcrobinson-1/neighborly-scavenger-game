import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import {
  parseAuthoringGameDraftContent,
  type AuthoringGameDraftContent,
} from "../../../shared/game-config.ts";
import { authenticateQuizAdmin, type AdminAuthResult } from "../_shared/admin-auth.ts";
import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";

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

export const defaultSaveDraftHandlerDependencies: SaveDraftHandlerDependencies = {
  authenticateQuizAdmin,
  createCorsHeaders,
  getAllowedOrigin,
  getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  getSupabaseClientKey: () =>
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY"),
  getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
  parseAuthoringGameDraftContent,
  saveDraft,
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  createHeaders: SaveDraftHandlerDependencies["createCorsHeaders"],
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
  if (error.code === "23505" || error.message.includes("duplicate key")) {
    return 409;
  }

  return 500;
}

export function validateDraftSavePayload(payload: unknown): DraftSaveRequestBody | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
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
  dependencies: SaveDraftHandlerDependencies = defaultSaveDraftHandlerDependencies,
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

    const payload = validateDraftSavePayload(await request.json().catch(() => null));

    if (!payload) {
      return jsonResponse(
        400,
        { error: "Invalid draft save payload." },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    let content: AuthoringGameDraftContent;

    try {
      content = dependencies.parseAuthoringGameDraftContent(payload.content);
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

    const { data, error } = await dependencies.saveDraft(
      {
        actorUserId: admin.userId,
        content,
      },
      supabaseUrl,
      serviceRoleKey,
    );

    // Draft table writes are service-role-owned after the admin check so the
    // browser cannot bypass normalization by writing directly through PostgREST.
    if (error || !data) {
      return jsonResponse(
        error ? getPersistenceStatus(error) : 500,
        {
          details: error?.message,
          error:
            error && getPersistenceStatus(error) === 409
              ? "A quiz event already uses that slug."
              : "We couldn't save the draft right now.",
        },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    return jsonResponse(
      200,
      {
        id: data.id,
        liveVersionNumber: data.live_version_number,
        name: data.name,
        slug: data.slug,
        updatedAt: data.updated_at,
      },
      origin,
      dependencies.createCorsHeaders,
    );
  };
}

/** Saves a canonical private quiz draft for an authenticated admin. */
export const handleSaveDraftRequest = createSaveDraftHandler();

if (import.meta.main) {
  Deno.serve(handleSaveDraftRequest);
}
