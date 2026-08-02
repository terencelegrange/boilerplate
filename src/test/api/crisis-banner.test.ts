// src/test/api/crisis-banner.test.ts
import { describe, it, expect } from "vitest";
import { GET as getBanner, PATCH as patchBanner } from "@/app/api/crisis-banner/route";
import { makeRequest, adminRequest, userRequest } from "../helpers";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe("GET /api/crisis-banner", () => {
  it("returns inactive defaults when never configured", async () => {
    const res = await getBanner();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.active).toBe(false);
    expect(body.message).toBe("");
  });

  it("is active when enabled with no date bounds", async () => {
    const req = await adminRequest("/api/crisis-banner", "PATCH", { message: "Down for maintenance", enabled: true });
    await patchBanner(req as any);
    const res = await getBanner();
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.message).toBe("Down for maintenance");
  });

  it("is inactive when enabled but before the start date", async () => {
    const req = await adminRequest("/api/crisis-banner", "PATCH", {
      message: "Future event", enabled: true, startDate: isoDate(5),
    });
    await patchBanner(req as any);
    const res = await getBanner();
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  it("is inactive when enabled but after the end date", async () => {
    const req = await adminRequest("/api/crisis-banner", "PATCH", {
      message: "Past event", enabled: true, endDate: isoDate(-5),
    });
    await patchBanner(req as any);
    const res = await getBanner();
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  it("is active when today falls within the start/end window", async () => {
    const req = await adminRequest("/api/crisis-banner", "PATCH", {
      message: "Ongoing", enabled: true, startDate: isoDate(-1), endDate: isoDate(1),
    });
    await patchBanner(req as any);
    const res = await getBanner();
    const body = await res.json();
    expect(body.active).toBe(true);
  });

  it("is inactive when disabled even within the date window", async () => {
    const req = await adminRequest("/api/crisis-banner", "PATCH", {
      message: "Disabled", enabled: false, startDate: isoDate(-1), endDate: isoDate(1),
    });
    await patchBanner(req as any);
    const res = await getBanner();
    const body = await res.json();
    expect(body.active).toBe(false);
  });
});

describe("PATCH /api/crisis-banner", () => {
  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/crisis-banner", "PATCH", { enabled: true });
    const res = await patchBanner(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const req = makeRequest("PATCH", "/api/crisis-banner", { enabled: true });
    const res = await patchBanner(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 400 when body has nothing to update", async () => {
    const req = await adminRequest("/api/crisis-banner", "PATCH", {});
    const res = await patchBanner(req as any);
    expect(res.status).toBe(400);
  });
});
