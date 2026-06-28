// src/test/api/dashboard.test.ts
import { describe, it, expect } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getOverview } from "@/app/api/settings/overview/route";
import { makeUser, makeAdmin, makeToken, mockAuth, userRequest, adminRequest } from "../helpers";

// ─── GET /api/dashboard ──────────────────────────────────────
describe("GET /api/dashboard", () => {
  it("returns stats and recentUsers for any authenticated user", async () => {
    await makeUser();
    await makeUser({ status: "pending" });
    await userRequest("/api/dashboard");
    const res = await getDashboard();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalUsers).toBe("number");
    expect(typeof body.pendingUsers).toBe("number");
    expect(typeof body.approvedUsers).toBe("number");
    expect(typeof body.auditCount).toBe("number");
    expect(Array.isArray(body.recentUsers)).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getDashboard();
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/settings/overview ─────────────────────────────
// Note: this route returns 401 (not 403) for unauthenticated requests —
// the guard is: if (!session) → 401, then if (role !== 'admin') → 403.
describe("GET /api/settings/overview", () => {
  it("returns full overview stats for admin", async () => {
    await makeUser();
    await adminRequest("/api/settings/overview");
    const res = await getOverview();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalUsers).toBe("number");
    expect(typeof body.pendingUsers).toBe("number");
    expect(typeof body.auditEvents).toBe("number");
    expect(Array.isArray(body.newUsers)).toBe(true);
    expect(Array.isArray(body.recentAudit)).toBe(true);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/settings/overview");
    const res = await getOverview();
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    // No auth set — beforeEach resets to mockNoAuth
    const res = await getOverview();
    expect(res.status).toBe(401);
  });
});
