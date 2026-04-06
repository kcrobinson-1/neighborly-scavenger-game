import { describe, expect, it } from "vitest";
import {
  featuredGameSlug,
  games,
  gamesById,
  gamesBySlug,
  getGameById,
  getGameBySlug,
} from "../../../shared/game-config.ts";

// These lookups back both route resolution and backend event resolution, so a
// tiny catalog suite buys confidence across the whole stack.
describe("game catalog", () => {
  it("resolves the featured sample game by both id and slug", () => {
    const featuredGame = getGameBySlug(featuredGameSlug);

    expect(featuredGame).toBeDefined();
    expect(featuredGame?.slug).toBe(featuredGameSlug);
    expect(getGameById(featuredGame!.id)).toBe(featuredGame);
  });

  it("returns undefined for unknown ids and slugs", () => {
    expect(getGameById("missing-game")).toBeUndefined();
    expect(getGameBySlug("missing-game")).toBeUndefined();
  });

  it("builds lookups that include every sample game exactly once", () => {
    expect(Object.keys(gamesById)).toHaveLength(games.length);
    expect(Object.keys(gamesBySlug)).toHaveLength(games.length);

    expect(
      games.every((game) => gamesById[game.id] === game && gamesBySlug[game.slug] === game),
    ).toBe(true);
  });
});
