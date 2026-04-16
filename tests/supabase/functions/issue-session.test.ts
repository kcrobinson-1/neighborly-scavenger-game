import {
  assertEquals,
  assertExists,
} from "jsr:@std/assert@1";
import {
  createIssueSessionHandler,
  defaultIssueSessionHandlerDependencies,
} from "../../../supabase/functions/issue-session/index.ts";
import { createOriginRequest } from "./helpers.ts";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const allowedOrigin = "http://127.0.0.1:4173";
const signingSecret = "session-secret";

const existingSessionDeps = {
  ...defaultIssueSessionHandlerDependencies,
  getAllowedOrigin: () => allowedOrigin,
  getSigningSecret: () => signingSecret,
  readVerifiedSession: async () => ({
    sessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" as const,
    sessionToken: "existing-session-token",
  }),
} as const;

const newSessionDeps = {
  ...defaultIssueSessionHandlerDependencies,
  createSignedSessionCookie: async () => ({
    sessionId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" as const,
    sessionToken: "new-session-token",
    setCookieHeader: "neighborly_session=new-session-token; HttpOnly",
  }),
  getAllowedOrigin: () => allowedOrigin,
  getSigningSecret: () => signingSecret,
  readVerifiedSession: async () => null,
} as const;

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

// ---------------------------------------------------------------------------
// Quiz start tracking
// ---------------------------------------------------------------------------

Deno.test("issue-session inserts a start row for a new session when event_id is provided", async () => {
  const insertedStarts: { eventId: string; clientSessionId: string }[] = [];

  const handler = createIssueSessionHandler({
    ...newSessionDeps,
    getSupabaseUrl: () => "https://example.supabase.co",
    getServiceRoleKey: () => "service-role-key",
    insertQuizStart: async (eventId, clientSessionId) => {
      insertedStarts.push({ eventId, clientSessionId });
    },
  });

  const request = createOriginRequest("https://example.com", {
    method: "POST",
    body: JSON.stringify({ event_id: "event-abc" }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handler(request);

  assertEquals(response.status, 200);
  // Allow the best-effort fire-and-forget to settle before asserting.
  await new Promise((r) => setTimeout(r, 0));
  assertEquals(insertedStarts, [{ eventId: "event-abc", clientSessionId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }]);
});

Deno.test("issue-session inserts a start row for an existing session when event_id is provided", async () => {
  const insertedStarts: { eventId: string; clientSessionId: string }[] = [];

  const handler = createIssueSessionHandler({
    ...existingSessionDeps,
    getSupabaseUrl: () => "https://example.supabase.co",
    getServiceRoleKey: () => "service-role-key",
    insertQuizStart: async (eventId, clientSessionId) => {
      insertedStarts.push({ eventId, clientSessionId });
    },
  });

  const request = createOriginRequest("https://example.com", {
    method: "POST",
    body: JSON.stringify({ event_id: "event-abc" }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handler(request);

  assertEquals(response.status, 200);
  await new Promise((r) => setTimeout(r, 0));
  assertEquals(insertedStarts, [{ eventId: "event-abc", clientSessionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }]);
});

Deno.test("issue-session does not insert a start row when event_id is absent", async () => {
  const insertedStarts: { eventId: string; clientSessionId: string }[] = [];

  const handler = createIssueSessionHandler({
    ...newSessionDeps,
    getSupabaseUrl: () => "https://example.supabase.co",
    getServiceRoleKey: () => "service-role-key",
    insertQuizStart: async (eventId, clientSessionId) => {
      insertedStarts.push({ eventId, clientSessionId });
    },
  });

  const request = createOriginRequest("https://example.com", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handler(request);

  assertEquals(response.status, 200);
  await new Promise((r) => setTimeout(r, 0));
  assertEquals(insertedStarts, []);
});

Deno.test("issue-session returns 200 even when the start row insert fails", async () => {
  const handler = createIssueSessionHandler({
    ...newSessionDeps,
    getSupabaseUrl: () => "https://example.supabase.co",
    getServiceRoleKey: () => "service-role-key",
    insertQuizStart: async () => {
      throw new Error("database unavailable");
    },
  });

  const request = createOriginRequest("https://example.com", {
    method: "POST",
    body: JSON.stringify({ event_id: "event-abc" }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handler(request);

  // Session issuance must succeed even when analytics write fails.
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    issuedNewSession: true,
    sessionReady: true,
    sessionToken: "new-session-token",
  });
});
