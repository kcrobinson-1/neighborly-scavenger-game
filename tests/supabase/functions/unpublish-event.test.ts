import { assertEquals } from "jsr:@std/assert@1";
import {
  createUnpublishEventHandler,
  defaultUnpublishEventHandlerDependencies,
} from "../../../supabase/functions/unpublish-event/index.ts";
import {
  adminUserId,
  createAuthoringRequest,
  sampleDraft,
} from "./authoring-helpers.ts";

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
