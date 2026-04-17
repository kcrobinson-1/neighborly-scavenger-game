import { type AdminAuthResult, authenticateQuizAdmin } from "./admin-auth.ts";
import { createCorsHeaders, getAllowedOrigin } from "./cors.ts";

/**
 * Shared authoring HTTP boundary for authenticated admin write functions.
 * Owns origin/method/config gates, admin allowlist auth, and consistent JSON
 * response wiring so each authoring endpoint can focus on domain logic.
 */
type JsonBody = Record<string, unknown>;

/** Injectable dependencies for the shared authoring HTTP handler factory. */
export type AuthoringHttpDependencies = {
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
};

/** Trusted context passed to one authenticated authoring request handler. */
export type AuthoringRequestContext = {
  admin: Extract<AdminAuthResult, { status: "ok" }>;
  jsonResponse: (status: number, body: JsonBody) => Response;
  serviceRoleKey: string;
  supabaseUrl: string;
};

export const defaultAuthoringHttpDependencies: AuthoringHttpDependencies = {
  authenticateQuizAdmin,
  createCorsHeaders,
  getAllowedOrigin,
  getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  getSupabaseClientKey: () =>
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY"),
  getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
};

/** Builds one JSON response with shared authoring CORS headers applied. */
export function createAuthoringJsonResponse(
  status: number,
  body: JsonBody,
  origin: string | null,
  createHeaders: AuthoringHttpDependencies["createCorsHeaders"],
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...createHeaders(origin),
      "Content-Type": "application/json",
    },
    status,
  });
}

/**
 * Creates a POST-only authoring handler with shared trust checks.
 * The returned handler enforces allowed origin, CORS preflight, server config,
 * and admin allowlist auth before executing `handleRequest`.
 */
export function createAuthoringPostHandler(
  dependencies: AuthoringHttpDependencies,
  handleRequest: (
    request: Request,
    context: AuthoringRequestContext,
  ) => Response | Promise<Response>,
) {
  return async (request: Request) => {
    const origin = dependencies.getAllowedOrigin(request);

    if (!origin) {
      return createAuthoringJsonResponse(
        403,
        { error: "Origin not allowed." },
        null,
        dependencies.createCorsHeaders,
      );
    }

    if (request.method === "OPTIONS") {
      return new Response("ok", {
        headers: dependencies.createCorsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return createAuthoringJsonResponse(
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
      return createAuthoringJsonResponse(
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
      return createAuthoringJsonResponse(
        admin.status === "unauthenticated" ? 401 : 403,
        { error: admin.error },
        origin,
        dependencies.createCorsHeaders,
      );
    }

    return await handleRequest(request, {
      admin,
      jsonResponse: (status, body) =>
        createAuthoringJsonResponse(
          status,
          body,
          origin,
          dependencies.createCorsHeaders,
        ),
      serviceRoleKey,
      supabaseUrl,
    });
  };
}
