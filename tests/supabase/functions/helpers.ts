export async function withEnvironment(
  values: Record<string, string | null>,
  run: () => void | Promise<void>,
) {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previousValues.set(key, Deno.env.get(key));

    if (value === null) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }

  try {
    await run();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

export function createOriginRequest(
  url: string,
  init: RequestInit = {},
  origin = "http://127.0.0.1:4173",
) {
  const headers = new Headers(init.headers);
  headers.set("origin", origin);

  return new Request(url, {
    ...init,
    headers,
  });
}
