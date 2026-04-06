import {
  assertEquals,
  assertFalse,
  assertMatch,
} from "jsr:@std/assert@1";
import {
  createCorsHeaders,
  getAllowedOrigin,
} from "../../../supabase/functions/_shared/cors.ts";
import { createOriginRequest, withEnvironment } from "./helpers.ts";

Deno.test("getAllowedOrigin uses the built-in allowlist when ALLOWED_ORIGINS is absent", async () => {
  await withEnvironment({ ALLOWED_ORIGINS: null }, () => {
    const allowedRequest = createOriginRequest("https://example.com");
    const disallowedRequest = createOriginRequest(
      "https://example.com",
      {},
      "https://not-allowed.example",
    );

    assertEquals(getAllowedOrigin(allowedRequest), "http://127.0.0.1:4173");
    assertEquals(getAllowedOrigin(disallowedRequest), null);
  });
});

Deno.test("getAllowedOrigin uses the configured allowlist when ALLOWED_ORIGINS is set", async () => {
  await withEnvironment(
    { ALLOWED_ORIGINS: "https://quiz.example, https://preview.example " },
    () => {
      const configuredRequest = createOriginRequest(
        "https://example.com",
        {},
        "https://preview.example",
      );
      const defaultOnlyRequest = createOriginRequest("https://example.com");

      assertEquals(getAllowedOrigin(configuredRequest), "https://preview.example");
      assertEquals(getAllowedOrigin(defaultOnlyRequest), null);
    },
  );
});

Deno.test("createCorsHeaders reflects the allowed origin and shared trust headers", () => {
  const headersWithOrigin = createCorsHeaders("https://quiz.example");
  const headersWithoutOrigin = createCorsHeaders(null);

  assertEquals(headersWithOrigin["Access-Control-Allow-Origin"], "https://quiz.example");
  assertMatch(
    headersWithOrigin["Access-Control-Allow-Headers"],
    /x-neighborly-session/,
  );
  assertEquals(headersWithOrigin["Access-Control-Allow-Credentials"], "true");
  assertFalse("Access-Control-Allow-Origin" in headersWithoutOrigin);
});
