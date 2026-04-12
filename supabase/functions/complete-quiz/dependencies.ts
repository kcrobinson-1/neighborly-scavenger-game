import {
  type GameConfig,
  normalizeSubmittedAnswers,
  scoreAnswers,
  validateSubmittedAnswers,
} from "../../../shared/game-config.ts";
import { createCorsHeaders, getAllowedOrigin } from "../_shared/cors.ts";
import { loadPublishedGameById } from "../_shared/published-game-loader.ts";
import { readVerifiedSession } from "../_shared/session-cookie.ts";
import {
  type CompletionPersistenceInput,
  type CompletionPersistenceResult,
  persistCompletion,
} from "./persistence.ts";

export type CompleteQuizHandlerDependencies = {
  createCorsHeaders: typeof createCorsHeaders;
  getAllowedOrigin: typeof getAllowedOrigin;
  getServiceRoleKey: () => string | undefined;
  getSigningSecret: () => string | undefined;
  getSupabaseUrl: () => string | undefined;
  loadPublishedGameById: (
    gameId: string,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<GameConfig | null>;
  normalizeSubmittedAnswers: typeof normalizeSubmittedAnswers;
  persistCompletion: (
    input: CompletionPersistenceInput,
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<CompletionPersistenceResult>;
  readVerifiedSession: typeof readVerifiedSession;
  scoreAnswers: typeof scoreAnswers;
  validateSubmittedAnswers: typeof validateSubmittedAnswers;
};

export const defaultCompleteQuizHandlerDependencies:
  CompleteQuizHandlerDependencies = {
    createCorsHeaders,
    getAllowedOrigin,
    getServiceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    getSigningSecret: () => Deno.env.get("SESSION_SIGNING_SECRET"),
    getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),
    loadPublishedGameById,
    normalizeSubmittedAnswers,
    persistCompletion,
    readVerifiedSession,
    scoreAnswers,
    validateSubmittedAnswers,
  };
