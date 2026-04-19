import { createClient } from "jsr:@supabase/supabase-js@2.101.1";
import {
  type AuthoringHttpDependencies,
  createAuthoringPostHandler,
  defaultAuthoringHttpDependencies,
} from "../_shared/authoring-http.ts";

type EventCodePersistenceResult = {
  data: string | null;
  error: { message: string } | null;
};

export type GenerateEventCodeHandlerDependencies = {
  authoringHttp: AuthoringHttpDependencies;
  generateEventCode: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<EventCodePersistenceResult>;
};

async function generateEventCode(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<EventCodePersistenceResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data, error } = await supabase.rpc("generate_random_event_code");

  if (error) {
    return { data: null, error };
  }

  if (typeof data !== "string") {
    return {
      data: null,
      error: { message: "Event code generation returned an invalid response." },
    };
  }

  return { data, error: null };
}

export const defaultGenerateEventCodeHandlerDependencies:
  GenerateEventCodeHandlerDependencies = {
    authoringHttp: defaultAuthoringHttpDependencies,
    generateEventCode,
  };

/** Builds the request handler used by the authenticated event-code endpoint. */
export function createGenerateEventCodeHandler(
  dependencies: GenerateEventCodeHandlerDependencies =
    defaultGenerateEventCodeHandlerDependencies,
) {
  return createAuthoringPostHandler(
    dependencies.authoringHttp,
    async (_request, context) => {
      const { data, error } = await dependencies.generateEventCode(
        context.supabaseUrl,
        context.serviceRoleKey,
      );

      if (error || !data) {
        return context.jsonResponse(
          500,
          {
            details: error?.message,
            error: "We couldn't generate an event code right now.",
          },
        );
      }

      return context.jsonResponse(200, { eventCode: data });
    },
  );
}

/** Generates a non-persisted event-code suggestion for authenticated admins. */
export const handleGenerateEventCodeRequest = createGenerateEventCodeHandler();

if (import.meta.main) {
  Deno.serve(handleGenerateEventCodeRequest);
}
