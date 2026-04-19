import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  createGenerateEventCodeHandler,
  defaultGenerateEventCodeHandlerDependencies,
} from "../../../supabase/functions/generate-event-code/index.ts";
import {
  adminUserId,
  createAuthoringHttpDependencies,
  createAuthoringRequest,
} from "./authoring-helpers.ts";
import { createOriginRequest } from "./helpers.ts";

Deno.test("generate-event-code rejects unsupported methods after the origin gate", async () => {
  const handler = createGenerateEventCodeHandler({
    ...defaultGenerateEventCodeHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => {
        throw new Error("authenticateQuizAdmin should not be called");
      },
    }),
    generateEventCode: async () => {
      throw new Error("generateEventCode should not be called");
    },
  });

  const response = await handler(
    createOriginRequest("https://example.com", { method: "GET" }),
  );

  assertEquals(response.status, 405);
  assertEquals(await response.json(), { error: "Method not allowed." });
});

Deno.test("generate-event-code rejects missing admin authentication", async () => {
  const handler = createGenerateEventCodeHandler({
    ...defaultGenerateEventCodeHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        error: "Admin authentication is required.",
        status: "unauthenticated",
      }),
    }),
    generateEventCode: async () => {
      throw new Error("generateEventCode should not be called");
    },
  });

  const response = await handler(createAuthoringRequest({}));

  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: "Admin authentication is required.",
  });
});

Deno.test("generate-event-code returns an unpersisted event-code suggestion", async () => {
  const handler = createGenerateEventCodeHandler({
    ...defaultGenerateEventCodeHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
    generateEventCode: async () => ({
      data: "XYZ",
      error: null,
    }),
  });

  const response = await handler(createAuthoringRequest({}));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload, { eventCode: "XYZ" });
  assertMatch(payload.eventCode, /^[A-Z]{3}$/);
});

Deno.test("generate-event-code reports generation failures", async () => {
  const handler = createGenerateEventCodeHandler({
    ...defaultGenerateEventCodeHandlerDependencies,
    authoringHttp: createAuthoringHttpDependencies({
      authenticateQuizAdmin: async () => ({
        status: "ok",
        userId: adminUserId,
      }),
    }),
    generateEventCode: async () => ({
      data: null,
      error: { message: "rpc failed" },
    }),
  });

  const response = await handler(createAuthoringRequest({}));

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    details: "rpc failed",
    error: "We couldn't generate an event code right now.",
  });
});
