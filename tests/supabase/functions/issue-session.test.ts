import {
  assertEquals,
  assertExists,
} from "jsr:@std/assert@1";
import {
  createIssueSessionHandler,
  defaultIssueSessionHandlerDependencies,
} from "../../../supabase/functions/issue-session/index.ts";
import { createOriginRequest } from "./helpers.ts";

Deno.test("issue-session rejects disallowed origins before minting trust state", async () => {
  const handler = createIssueSessionHandler({
    ...defaultIssueSessionHandlerDependencies,
    getAllowedOrigin: () => null,
  });

  const response = await handler(new Request("https://example.com", { method: "POST" }));

  assertEquals(response.status, 403);
  assertEquals(await response.json(), { error: "Origin not allowed." });
});

Deno.test("issue-session rejects unsupported methods after the origin gate", async () => {
  const handler = createIssueSessionHandler({
    ...defaultIssueSessionHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
  });

  const response = await handler(createOriginRequest("https://example.com", { method: "GET" }));

  assertEquals(response.status, 405);
  assertEquals(await response.json(), { error: "Method not allowed." });
});

Deno.test("issue-session reuses an existing verified session", async () => {
  const handler = createIssueSessionHandler({
    ...defaultIssueSessionHandlerDependencies,
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getSigningSecret: () => "session-secret",
    readVerifiedSession: async () => ({
      sessionId: "session-id",
      sessionToken: "existing-session-token",
    }),
  });

  const response = await handler(createOriginRequest("https://example.com", { method: "POST" }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    issuedNewSession: false,
    sessionReady: true,
    sessionToken: "existing-session-token",
  });
});

Deno.test("issue-session issues a new signed session and returns Set-Cookie", async () => {
  const handler = createIssueSessionHandler({
    ...defaultIssueSessionHandlerDependencies,
    createSignedSessionCookie: async () => ({
      sessionId: "123e4567-e89b-12d3-a456-426614174000",
      sessionToken: "new-session-token",
      setCookieHeader: "neighborly_session=new-session-token; HttpOnly",
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getSigningSecret: () => "session-secret",
    readVerifiedSession: async () => null,
  });

  const response = await handler(createOriginRequest("https://example.com", { method: "POST" }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    issuedNewSession: true,
    sessionReady: true,
    sessionToken: "new-session-token",
  });
  assertExists(response.headers.get("Set-Cookie"));
});
