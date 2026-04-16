import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { AuthoringGameDraftContent } from "../../shared/game-config";
import { getGameById } from "../../shared/game-config/sample-fixtures";

type SupabaseEnv = {
  serviceRoleKey: string;
  supabaseUrl: string;
};

type FixtureConfig = {
  adminEmail: string;
  deniedAdminEmail: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  adminRedirectUrl: string;
};

type AdminFixtureOptions = {
  includeDeniedUserLink?: boolean;
};

type AdminFixture = {
  eventId: string;
  eventName: string;
  eventSlug: string;
  magicLinkUrl: string;
  deniedMagicLinkUrl?: string;
};

const defaultAdminEmail = "phase5-admin-e2e@example.com";
const defaultDeniedAdminEmail = "phase5-admin-denied-e2e@example.com";
const defaultEventId = "phase5-admin-e2e-event";
const defaultEventSlug = "phase5-admin-e2e-slug";
const defaultEventName = "Phase 5.1 Admin E2E Event";
const defaultAdminRedirectUrl = "http://127.0.0.1:4173/admin";

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function readSupabaseEnv(): SupabaseEnv {
  return {
    serviceRoleKey: readRequiredEnv("TEST_SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: readRequiredEnv("TEST_SUPABASE_URL"),
  };
}

function readFixtureConfig(): FixtureConfig {
  const baseUrl = readOptionalEnv("PRODUCTION_SMOKE_BASE_URL")?.replace(/\/$/, "");

  return {
    adminEmail: readOptionalEnv("TEST_ADMIN_EMAIL") ?? defaultAdminEmail,
    deniedAdminEmail: readOptionalEnv("TEST_DENIED_ADMIN_EMAIL") ?? defaultDeniedAdminEmail,
    eventId: readOptionalEnv("TEST_ADMIN_EVENT_ID") ?? defaultEventId,
    eventName: readOptionalEnv("TEST_ADMIN_EVENT_NAME") ?? defaultEventName,
    eventSlug: readOptionalEnv("TEST_ADMIN_EVENT_SLUG") ?? defaultEventSlug,
    adminRedirectUrl:
      readOptionalEnv("TEST_ADMIN_REDIRECT_URL") ??
      (baseUrl ? `${baseUrl}/admin` : defaultAdminRedirectUrl),
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

function createDraftContent(config: FixtureConfig): AuthoringGameDraftContent {
  const sampleDraft = getGameById("madrona-music-2026");

  if (!sampleDraft) {
    throw new Error("Expected the featured sample draft to exist.");
  }

  return {
    ...sampleDraft,
    id: config.eventId,
    name: config.eventName,
    slug: config.eventSlug,
  };
}

function maskValueForGitHubActions(value: string | undefined) {
  if (!value || process.env.GITHUB_ACTIONS !== "true") {
    return;
  }

  console.log(`::add-mask::${value}`);
}

async function generateMagicLink(
  serviceRoleClient: ReturnType<typeof createServiceRoleClient>,
  email: string,
  redirectTo: string,
) {
  const { data: generatedLink, error: generateLinkError } =
    await serviceRoleClient.auth.admin.generateLink({
      email,
      options: {
        redirectTo,
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

  maskValueForGitHubActions(magicLinkUrl);

  return magicLinkUrl;
}

export async function ensureAdminE2eFixture(
  options: AdminFixtureOptions = {},
): Promise<AdminFixture> {
  const { includeDeniedUserLink = false } = options;
  const config = readFixtureConfig();
  const env = readSupabaseEnv();
  const serviceRoleClient = createServiceRoleClient(env);

  const { error: allowlistError } = await serviceRoleClient
    .from("quiz_admin_users")
    .upsert(
      {
        active: true,
        email: config.adminEmail,
      },
      { onConflict: "email" },
    );

  if (allowlistError) {
    throw new Error(`Failed to upsert admin allowlist row: ${allowlistError.message}`);
  }

  const { error: deniedAllowlistError } = await serviceRoleClient
    .from("quiz_admin_users")
    .upsert(
      {
        active: false,
        email: config.deniedAdminEmail,
      },
      { onConflict: "email" },
    );

  if (deniedAllowlistError) {
    throw new Error(
      `Failed to upsert denied admin allowlist row: ${deniedAllowlistError.message}`,
    );
  }

  const { error: ensureDraftError } = await serviceRoleClient
    .from("quiz_event_drafts")
    .upsert(
      {
        content: createDraftContent(config),
        id: config.eventId,
        live_version_number: null,
        name: config.eventName,
        slug: config.eventSlug,
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
      slug: config.eventSlug,
    })
    .eq("id", config.eventId);

  if (unpublishSeedError) {
    throw new Error(`Failed to reset test event publish state: ${unpublishSeedError.message}`);
  }

  const magicLinkUrl = await generateMagicLink(
    serviceRoleClient,
    config.adminEmail,
    config.adminRedirectUrl,
  );

  const deniedMagicLinkUrl = includeDeniedUserLink
    ? await generateMagicLink(
        serviceRoleClient,
        config.deniedAdminEmail,
        config.adminRedirectUrl,
      )
    : undefined;

  return {
    deniedMagicLinkUrl,
    eventId: config.eventId,
    eventName: config.eventName,
    eventSlug: config.eventSlug,
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
