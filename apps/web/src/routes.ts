export const routes = {
  home: "/",
  sampleGame: "/game/first-sample",
} as const;

export function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}
