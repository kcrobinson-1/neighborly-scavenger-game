import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { AuthoringGameDraftContent } from "../../shared/game-config";
import { getGameById } from "../../shared/game-config/sample-fixtures";

const adminEmail = "phase5-admin-e2e@example.com";
const eventId = "phase5-admin-e2e-event";
const eventSlug = "phase5-admin-e2e-slug";
const eventName = "Phase 5.1 Admin E2E Event";
const adminRedirectUrl = "http://127.0.0.1:4173/admin";

type SupabaseEnv = {
  serviceRoleKey: string;
  supabaseUrl: string;
};

type AdminFixture = {
  eventId: string;
  eventName: string;
  eventSlug: string;
  magicLinkUrl: string;
};

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readSupabaseEnv(): SupabaseEnv {
  return {
    serviceRoleKey: readRequiredEnv("TEST_SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: readRequiredEnv("TEST_SUPABASE_URL"),
  };
}

function createServiceRoleClient(env: SupabaseEnv) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createDraftContent(): AuthoringGameDraftContent {
  const sampleDraft = getGameById("madrona-music-2026");

  if (!sampleDraft) {
    throw new Error("Expected the featured sample draft to exist.");
  }

  return {
    ...sampleDraft,
    id: eventId,
    name: eventName,
    slug: eventSlug,
  };
}

export async function ensureAdminE2eFixture(): Promise<AdminFixture> {
  const env = readSupabaseEnv();
  const serviceRoleClient = createServiceRoleClient(env);

  const { error: allowlistError } = await serviceRoleClient
    .from("quiz_admin_users")
    .upsert(
      {
        active: true,
        email: adminEmail,
      },
      { onConflict: "email" },
    );

  if (allowlistError) {
    throw new Error(`Failed to upsert admin allowlist row: ${allowlistError.message}`);
  }

  const { error: ensureDraftError } = await serviceRoleClient
    .from("quiz_event_drafts")
    .upsert(
      {
        content: createDraftContent(),
        id: eventId,
        live_version_number: null,
        name: eventName,
        slug: eventSlug,
      },
      { onConflict: "id" },
    );

  if (ensureDraftError) {
    throw new Error(`Failed to upsert admin test draft row: ${ensureDraftError.message}`);
  }

  // Ensure the test event starts unpublished so the publish assertion is deterministic.
  const { error: unpublishSeedError } = await serviceRoleClient
    .from("quiz_events")
    .update({
      published_at: null,
      slug: eventSlug,
    })
    .eq("id", eventId);

  if (unpublishSeedError) {
    throw new Error(`Failed to reset test event publish state: ${unpublishSeedError.message}`);
  }

  const { data: generatedLink, error: generateLinkError } =
    await serviceRoleClient.auth.admin.generateLink({
      email: adminEmail,
      options: {
        redirectTo: adminRedirectUrl,
        shouldCreateUser: true,
      },
      type: "magiclink",
    });

  if (generateLinkError) {
    throw new Error(`Failed to generate admin magic link: ${generateLinkError.message}`);
  }

  const magicLinkUrl = generatedLink.properties?.action_link;

  if (!magicLinkUrl) {
    throw new Error("Supabase did not return an action_link for the admin magic link.");
  }

  return {
    eventId,
    eventName,
    eventSlug,
    magicLinkUrl,
  };
}

export async function readPublishedEventState(id: string): Promise<{
  publishedAt: string | null;
  slug: string;
} | null> {
  const env = readSupabaseEnv();
  const serviceRoleClient = createServiceRoleClient(env);

  const { data, error } = await serviceRoleClient
    .from("quiz_events")
    .select("published_at,slug")
    .eq("id", id)
    .maybeSingle<{ published_at: string | null; slug: string }>();

  if (error) {
    throw new Error(`Failed to read published event state: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    publishedAt: data.published_at,
    slug: data.slug,
  };
}

export async function installAuthoringFunctionProxy(page: Page) {
  const env = readSupabaseEnv();
  const baseUrl = env.supabaseUrl.replace(/\/$/, "");
  const functionNames = new Set(["save-draft", "publish-draft", "unpublish-event"]);

  await page.route(`${baseUrl}/functions/v1/**`, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const functionName = requestUrl.pathname.split("/").at(-1) ?? "";

    if (!functionNames.has(functionName)) {
      await route.continue();
      return;
    }

    if (request.method() === "OPTIONS") {
      const requestedHeaders = await request.headerValue(
        "access-control-request-headers",
      );
      await route.fulfill({
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-headers":
            requestedHeaders ??
            "authorization,apikey,content-type,x-client-info",
          "access-control-allow-methods": "POST,OPTIONS",
          "access-control-allow-origin": "http://127.0.0.1:4173",
          vary: "Origin",
        },
        status: 200,
      });
      return;
    }

    const requestApikey = await request.headerValue("apikey");
    const requestAuthorization = await request.headerValue("authorization");
    const requestContentType = await request.headerValue("content-type");
    const headers: Record<string, string> = {
      origin: "http://127.0.0.1:4173",
    };

    if (requestApikey) {
      headers.apikey = requestApikey;
    }

    if (requestAuthorization) {
      headers.Authorization = requestAuthorization;
    }

    if (requestContentType) {
      headers["Content-Type"] = requestContentType;
    }

    const response = await fetch(request.url(), {
      body: request.postData() ?? undefined,
      headers,
      method: request.method(),
    });

    await route.fulfill({
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "application/json",
      status: response.status,
    });
  });
}
