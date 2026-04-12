import { createClient } from "jsr:@supabase/supabase-js@2.101.1";

/** Shape returned by the completion RPC before it is mapped to the API response. */
export type CompletionRpcRow = {
  attempt_number: number;
  completion_id: string;
  entitlement_created_at: string;
  entitlement_status: "existing" | "new";
  message: string;
  raffle_eligible: boolean;
  score: number;
  verification_code: string;
};

export type CompletionPersistenceInput = {
  durationMs: number;
  eventId: string;
  normalizedAnswers: Record<string, string[]>;
  requestId: string;
  sessionId: string;
  trustedScore: number;
};

export type CompletionPersistenceResult = {
  data: CompletionRpcRow | null;
  error: { message: string } | null;
};

export async function persistCompletion(
  input: CompletionPersistenceInput,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<CompletionPersistenceResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return await supabase
    .rpc("complete_quiz_and_award_entitlement", {
      p_client_session_id: input.sessionId,
      p_duration_ms: input.durationMs,
      p_event_id: input.eventId,
      p_request_id: input.requestId,
      p_score: input.trustedScore,
      p_submitted_answers: input.normalizedAnswers,
    })
    .single<CompletionRpcRow>();
}
