import {
  assertEquals,
  assertExists,
} from "jsr:@std/assert@1";
import { getGameById } from "../../../shared/game-config/sample-fixtures.ts";
import {
  createPublishDraftHandler,
  defaultPublishDraftHandlerDependencies,
} from "../../../supabase/functions/publish-draft/index.ts";
import {
  createSaveDraftHandler,
  defaultSaveDraftHandlerDependencies,
  validateDraftSavePayload,
} from "../../../supabase/functions/save-draft/index.ts";
import {
  createUnpublishEventHandler,
  defaultUnpublishEventHandlerDependencies,
} from "../../../supabase/functions/unpublish-event/index.ts";
import { createOriginRequest } from "./helpers.ts";

const sampleDraft = getGameById("madrona-music-2026");
const adminUserId = "22222222-2222-4222-8222-222222222222";

if (!sampleDraft) {
  throw new Error("Expected the featured sample game to exist for authoring tests.");
}

function createAuthoringRequest(body: unknown) {
  return createOriginRequest("https://example.com", {
    body: JSON.stringify(body),
    headers: {
      Authorization: "Bearer user-token",
    },
    method: "POST",
  });
}

Deno.test("validateDraftSavePayload requires a content property", () => {
  assertEquals(validateDraftSavePayload(null), null);
  assertEquals(validateDraftSavePayload({}), null);
  assertEquals(validateDraftSavePayload({ content: sampleDraft }), {
    content: sampleDraft,
  });
});

Deno.test("save-draft rejects missing admin authentication", async () => {
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      error: "Admin authentication is required.",
      status: "unauthenticated",
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    saveDraft: async () => {
      throw new Error("saveDraft should not be called");
    },
  });

  const response = await handler(createAuthoringRequest({ content: sampleDraft }));

  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: "Admin authentication is required.",
  });
});

Deno.test("save-draft rejects authenticated non-admin users", async () => {
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      error: "This account is not allowlisted for quiz authoring.",
      status: "forbidden",
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    saveDraft: async () => {
      throw new Error("saveDraft should not be called");
    },
  });

  const response = await handler(createAuthoringRequest({ content: sampleDraft }));

  assertEquals(response.status, 403);
  assertEquals(await response.json(), {
    error: "This account is not allowlisted for quiz authoring.",
  });
});

Deno.test("save-draft rejects malformed draft content before persistence", async () => {
  let saveCalls = 0;
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    saveDraft: async () => {
      saveCalls += 1;
      return { data: null, error: null };
    },
  });

  const response = await handler(
    createAuthoringRequest({
      content: {
        ...sampleDraft,
        questions: [],
      },
    }),
  );

  assertEquals(response.status, 400);
  assertExists((await response.json()).details);
  assertEquals(saveCalls, 0);
});

Deno.test("save-draft upserts the normalized draft and returns a safe summary", async () => {
  let capturedInput:
    | {
      actorUserId: string;
      content: typeof sampleDraft;
    }
    | null = null;
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    saveDraft: async (input) => {
      capturedInput = input;

      return {
        data: {
          id: input.content.id,
          live_version_number: 2,
          name: input.content.name,
          slug: input.content.slug,
          updated_at: "2026-04-11T12:00:00.000Z",
        },
        error: null,
      };
    },
  });

  const response = await handler(createAuthoringRequest({ content: sampleDraft }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    id: sampleDraft.id,
    liveVersionNumber: 2,
    name: sampleDraft.name,
    slug: sampleDraft.slug,
    updatedAt: "2026-04-11T12:00:00.000Z",
  });
  assertEquals(capturedInput, {
    actorUserId: adminUserId,
    content: sampleDraft,
  });
});

Deno.test("save-draft reports slug conflicts as 409", async () => {
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    saveDraft: async () => ({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    }),
  });

  const response = await handler(createAuthoringRequest({ content: sampleDraft }));

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    details: "duplicate key value violates unique constraint",
    error: "A quiz event already uses that slug.",
  });
});

Deno.test("publish-draft rejects missing drafts", async () => {
  const handler = createPublishDraftHandler({
    ...defaultPublishDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadDraft: async () => ({ data: null, error: null }),
    publishDraft: async () => {
      throw new Error("publishDraft should not be called");
    },
  });

  const response = await handler(createAuthoringRequest({ eventId: "missing" }));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    details: "draft_not_found",
    error: "Draft content is invalid.",
  });
});

Deno.test("publish-draft rejects invalid draft content before publishing", async () => {
  let publishCalls = 0;
  const handler = createPublishDraftHandler({
    ...defaultPublishDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadDraft: async () => ({
      data: {
        content: {
          ...sampleDraft,
          questions: [],
        },
        id: sampleDraft.id,
        name: sampleDraft.name,
        slug: sampleDraft.slug,
      },
      error: null,
    }),
    publishDraft: async () => {
      publishCalls += 1;
      return { data: null, error: null };
    },
  });

  const response = await handler(createAuthoringRequest({ eventId: sampleDraft.id }));

  assertEquals(response.status, 400);
  assertExists((await response.json()).details);
  assertEquals(publishCalls, 0);
});

Deno.test("publish-draft calls the transactional RPC after admin and shared validation pass", async () => {
  let capturedInput:
    | {
      actorUserId: string;
      eventId: string;
    }
    | null = null;
  const handler = createPublishDraftHandler({
    ...defaultPublishDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadDraft: async () => ({
      data: {
        content: sampleDraft,
        id: sampleDraft.id,
        name: sampleDraft.name,
        slug: sampleDraft.slug,
      },
      error: null,
    }),
    publishDraft: async (eventId, actorUserId) => {
      capturedInput = {
        actorUserId,
        eventId,
      };

      return {
        data: {
          event_id: eventId,
          published_at: "2026-04-11T12:00:00.000Z",
          slug: sampleDraft.slug,
          version_number: 3,
        },
        error: null,
      };
    },
  });

  const response = await handler(createAuthoringRequest({ eventId: sampleDraft.id }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    eventId: sampleDraft.id,
    publishedAt: "2026-04-11T12:00:00.000Z",
    slug: sampleDraft.slug,
    versionNumber: 3,
  });
  assertEquals(capturedInput, {
    actorUserId: adminUserId,
    eventId: sampleDraft.id,
  });
});

Deno.test("publish-draft reports slug collisions as 409", async () => {
  const handler = createPublishDraftHandler({
    ...defaultPublishDraftHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    loadDraft: async () => ({
      data: {
        content: sampleDraft,
        id: sampleDraft.id,
        name: sampleDraft.name,
        slug: sampleDraft.slug,
      },
      error: null,
    }),
    publishDraft: async () => ({
      data: null,
      error: {
        message: "slug_collision",
      },
    }),
  });

  const response = await handler(createAuthoringRequest({ eventId: sampleDraft.id }));

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    details: "slug_collision",
    error: "A quiz event already uses that slug.",
  });
});

Deno.test("unpublish-event rejects authenticated non-admin users before persistence", async () => {
  let unpublishCalls = 0;
  const handler = createUnpublishEventHandler({
    ...defaultUnpublishEventHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      error: "This account is not allowlisted for quiz authoring.",
      status: "forbidden",
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    unpublishEvent: async () => {
      unpublishCalls += 1;
      return { data: null, error: null };
    },
  });

  const response = await handler(createAuthoringRequest({ eventId: sampleDraft.id }));

  assertEquals(response.status, 403);
  assertEquals(await response.json(), {
    error: "This account is not allowlisted for quiz authoring.",
  });
  assertEquals(unpublishCalls, 0);
});

Deno.test("unpublish-event calls only the unpublish RPC for admin users", async () => {
  let capturedInput:
    | {
      actorUserId: string;
      eventId: string;
    }
    | null = null;
  const handler = createUnpublishEventHandler({
    ...defaultUnpublishEventHandlerDependencies,
    authenticateQuizAdmin: async () => ({
      status: "ok",
      userId: adminUserId,
    }),
    getAllowedOrigin: () => "http://127.0.0.1:4173",
    getServiceRoleKey: () => "service-role-key",
    getSupabaseClientKey: () => "publishable-key",
    getSupabaseUrl: () => "http://127.0.0.1:54321",
    unpublishEvent: async (eventId, actorUserId) => {
      capturedInput = {
        actorUserId,
        eventId,
      };

      return {
        data: {
          event_id: eventId,
          unpublished_at: "2026-04-11T12:05:00.000Z",
        },
        error: null,
      };
    },
  });

  const response = await handler(createAuthoringRequest({ eventId: sampleDraft.id }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    eventId: sampleDraft.id,
    unpublishedAt: "2026-04-11T12:05:00.000Z",
  });
  assertEquals(capturedInput, {
    actorUserId: adminUserId,
    eventId: sampleDraft.id,
  });
});
