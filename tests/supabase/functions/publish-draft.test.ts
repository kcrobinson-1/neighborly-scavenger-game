import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  createPublishDraftHandler,
  defaultPublishDraftHandlerDependencies,
} from "../../../supabase/functions/publish-draft/index.ts";
import {
  adminUserId,
  createAuthoringHttpDependencies,
  createAuthoringRequest,
  sampleDraft,
} from "./authoring-helpers.ts";

Deno.test("publish-draft rejects missing drafts", async () => {
  const handler = createPublishDraftHandler({
    ...defaultPublishDraftHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
    loadDraft: async () => ({ data: null, error: null }),
    publishDraft: async () => {
      throw new Error("publishDraft should not be called");
    },
  });

  const response = await handler(
    createAuthoringRequest({ eventId: "missing" }),
  );

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
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
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

  const response = await handler(
    createAuthoringRequest({ eventId: sampleDraft.id }),
  );

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
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
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

  const response = await handler(
    createAuthoringRequest({ eventId: sampleDraft.id }),
  );

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
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
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

  const response = await handler(
    createAuthoringRequest({ eventId: sampleDraft.id }),
  );

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    details: "slug_collision",
    error: "A quiz event already uses that slug.",
  });
});
