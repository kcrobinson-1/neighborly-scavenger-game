import type { createCorsHeaders } from "../_shared/cors.ts";

/** Creates a JSON response with the shared CORS policy applied. */
export function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
  createResponseCorsHeaders: typeof createCorsHeaders,
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...createResponseCorsHeaders(origin),
      "Content-Type": "application/json",
    },
    status,
  });
}
