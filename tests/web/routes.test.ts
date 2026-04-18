import { describe, expect, it } from "vitest";
import { matchAdminEventPath, matchGamePath, routes } from "../../apps/web/src/routes";

describe("admin event routes", () => {
  it("builds and parses one selected admin event path", () => {
    const path = routes.adminEvent("madrona-music-2026");

    expect(path).toBe("/admin/events/madrona-music-2026");
    expect(matchAdminEventPath(path)).toEqual({
      eventId: "madrona-music-2026",
    });
  });

  it("rejects malformed admin event paths", () => {
    expect(matchAdminEventPath("/admin/events")).toBeNull();
    expect(matchAdminEventPath("/admin/events/")).toBeNull();
    expect(matchAdminEventPath("/admin/events/event-id/extra")).toBeNull();
    expect(matchAdminEventPath("/admin/events/event%2Fid")).toBeNull();
  });
});

describe("game routes", () => {
  it("builds and parses one attendee game path", () => {
    const path = routes.game("madrona-music-2026");

    expect(path).toBe("/event/madrona-music-2026/game");
    expect(matchGamePath(path)).toEqual({
      slug: "madrona-music-2026",
    });
  });

  it("rejects malformed and legacy game paths", () => {
    expect(matchGamePath("/game/madrona-music-2026")).toBeNull();
    expect(matchGamePath("/event/madrona-music-2026")).toBeNull();
    expect(matchGamePath("/event/madrona-music-2026/game/extra")).toBeNull();
    expect(matchGamePath("/event/event%2Fid/game")).toBeNull();
  });
});
