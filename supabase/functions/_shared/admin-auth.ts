import { createClient } from "jsr:@supabase/supabase-js@2.101.1";

export type AdminAuthResult =
  | { status: "ok"; userId: string }
  | { error: string; status: "forbidden" | "unauthenticated" };

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

/** Verifies the caller's Supabase Auth JWT and checks the shared admin allowlist. */
export async function authenticateQuizAdmin(
  request: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  supabaseClientKey: string,
): Promise<AdminAuthResult> {
  const token = readBearerToken(request);

  if (!token) {
    return {
      error: "Admin authentication is required.",
      status: "unauthenticated",
    };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(
    token,
  );

  if (userError || !userData.user) {
    return {
      error: "Admin authentication is invalid.",
      status: "unauthenticated",
    };
  }

  // Use the caller's JWT for the allowlist RPC so the existing
  // `is_quiz_admin()` SQL helper evaluates the same request claims RLS uses.
  const userClient = createClient(supabaseUrl, supabaseClientKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data: isAdmin, error: adminError } = await userClient.rpc(
    "is_quiz_admin",
  );

  if (adminError || !isAdmin) {
    return {
      error: "This account is not allowlisted for quiz authoring.",
      status: "forbidden",
    };
  }

  return {
    status: "ok",
    userId: userData.user.id,
  };
}
