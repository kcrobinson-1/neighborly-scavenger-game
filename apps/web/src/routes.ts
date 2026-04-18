/** Application routes supported by the lightweight client-side router. */
export type AppPath =
  | "/"
  | "/admin"
  | `/admin/events/${string}`
  | `/event/${string}/game`;

/** Central route definitions used by the pathname-based client router. */
export const routes = {
  home: "/" as AppPath,
  admin: "/admin" as AppPath,
  adminEventsPrefix: "/admin/events",
  adminEvent: (eventId: string): AppPath =>
    `/admin/events/${encodeURIComponent(eventId)}`,
  gamePrefix: "/event",
  game: (slug: string): AppPath =>
    `/event/${encodeURIComponent(slug)}/game`,
} as const;

/** Removes trailing slashes so route comparisons stay stable. */
export function normalizePathname(pathname: string) {
  const normalizedPathname = pathname || routes.home;

  if (
    normalizedPathname.length > 1 &&
    normalizedPathname.endsWith("/")
  ) {
    return normalizedPathname.slice(0, -1);
  }

  return normalizedPathname;
}

/** Parses an admin event route and returns the decoded event id when matched. */
export function matchAdminEventPath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);
  const prefix = `${routes.adminEventsPrefix}/`;

  if (!normalizedPath.startsWith(prefix)) {
    return null;
  }

  const encodedEventId = normalizedPath.slice(prefix.length);

  if (!encodedEventId || encodedEventId.includes("/")) {
    return null;
  }

  try {
    const eventId = decodeURIComponent(encodedEventId);

    if (!eventId || eventId.includes("/")) {
      return null;
    }

    return {
      eventId,
    };
  } catch {
    return null;
  }
}

/** Parses a game route and returns the decoded slug when the path matches. */
export function matchGamePath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);
  const prefix = `${routes.gamePrefix}/`;
  const suffix = "/game";

  if (!normalizedPath.startsWith(prefix)) {
    return null;
  }

  if (!normalizedPath.endsWith(suffix)) {
    return null;
  }

  const encodedSlug = normalizedPath.slice(
    prefix.length,
    normalizedPath.length - suffix.length,
  );

  if (!encodedSlug || encodedSlug.includes("/")) {
    return null;
  }

  try {
    const slug = decodeURIComponent(encodedSlug);

    if (!slug || slug.includes("/")) {
      return null;
    }

    return {
      slug,
    };
  } catch {
    return null;
  }
}
