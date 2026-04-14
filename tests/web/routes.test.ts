import { describe, expect, it } from "vitest";
import { matchAdminEventPath, routes } from "../../apps/web/src/routes";

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
