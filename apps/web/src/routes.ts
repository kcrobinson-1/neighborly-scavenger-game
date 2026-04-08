/** Application routes supported by the lightweight client-side router. */
export type AppPath = "/" | "/admin" | `/game/${string}`;

/** Central route definitions used by the pathname-based client router. */
export const routes = {
  home: "/" as AppPath,
  admin: "/admin" as AppPath,
  gamePrefix: "/game",
  game: (slug: string): AppPath =>
    `/game/${encodeURIComponent(slug)}`,
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

/** Parses a game route and returns the decoded slug when the path matches. */
export function matchGamePath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);
  const prefix = `${routes.gamePrefix}/`;

  if (!normalizedPath.startsWith(prefix)) {
    return null;
  }

  const encodedSlug = normalizedPath.slice(prefix.length);

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
