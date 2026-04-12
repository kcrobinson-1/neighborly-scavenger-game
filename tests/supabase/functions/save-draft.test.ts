import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  createSaveDraftHandler,
  defaultSaveDraftHandlerDependencies,
  validateDraftSavePayload,
} from "../../../supabase/functions/save-draft/index.ts";
import {
  adminUserId,
  createAuthoringHttpDependencies,
  createAuthoringRequest,
  sampleDraft,
} from "./authoring-helpers.ts";

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
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        error: "Admin authentication is required.",
        status: "unauthenticated",
      }),
    }),
    saveDraft: async () => {
      throw new Error("saveDraft should not be called");
    },
  });

  const response = await handler(
    createAuthoringRequest({ content: sampleDraft }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: "Admin authentication is required.",
  });
});

Deno.test("save-draft rejects authenticated non-admin users", async () => {
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        error: "This account is not allowlisted for quiz authoring.",
        status: "forbidden",
      }),
    }),
    saveDraft: async () => {
      throw new Error("saveDraft should not be called");
    },
  });

  const response = await handler(
    createAuthoringRequest({ content: sampleDraft }),
  );

  assertEquals(response.status, 403);
  assertEquals(await response.json(), {
    error: "This account is not allowlisted for quiz authoring.",
  });
});

Deno.test("save-draft rejects malformed draft content before persistence", async () => {
  let saveCalls = 0;
  const handler = createSaveDraftHandler({
    ...defaultSaveDraftHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
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
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
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

  const response = await handler(
    createAuthoringRequest({ content: sampleDraft }),
  );

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
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
    saveDraft: async () => ({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    }),
  });

  const response = await handler(
    createAuthoringRequest({ content: sampleDraft }),
  );

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    details: "duplicate key value violates unique constraint",
    error: "A quiz event already uses that slug.",
  });
});
