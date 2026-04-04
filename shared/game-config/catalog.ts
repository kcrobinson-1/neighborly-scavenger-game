import { validateGames } from "./game-validation";
import { games } from "./sample-games";
import type { GameConfig } from "./types";

/** Builds an object lookup for games by a chosen stable key. */
function createGameLookup(key: keyof Pick<GameConfig, "id" | "slug">) {
  const lookup: Record<string, GameConfig> = {};

  for (const game of games) {
    const lookupKey = game[key];

    if (lookup[lookupKey]) {
      throw new Error(`Duplicate game ${key}: ${lookupKey}`);
    }

    lookup[lookupKey] = game;
  }

  return lookup;
}

validateGames(games);

/** Lookup table for resolving games by their server-facing id. */
export const gamesById: Record<string, GameConfig> = createGameLookup("id");
/** Lookup table for resolving games by their route slug. */
export const gamesBySlug: Record<string, GameConfig> = createGameLookup("slug");

/** Returns a game config by event id, if one exists. */
export function getGameById(gameId: string) {
  return gamesById[gameId];
}

/** Returns a game config by route slug, if one exists. */
export function getGameBySlug(slug: string) {
  return gamesBySlug[slug];
}
