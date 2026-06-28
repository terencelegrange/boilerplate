// src/test/api/feature-flags.test.ts
import { describe, it, expect } from "vitest";
import { GET as getFlags } from "@/app/api/feature-flags/route";
import { PATCH as patchFlag } from "@/app/api/feature-flags/[key]/route";
import { adminRequest, userRequest, makeRequest, mockNoAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── GET /api/feature-flags ──────────────────────────────────
describe("GET /api/feature-flags", () => {
  it("returns 200 with flags keyed by flag key for authenticated user", async () => {
    await userRequest("/api/feature-flags");
    const res = await getFlags();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    // Default flags seeded in setup: signup, dashboard, menu
    expect(body).toHaveProperty("signup");
    expect(body).toHaveProperty("dashboard");
    expect(body).toHaveProperty("menu");
    expect(typeof body.signup.enabled).toBe("boolean");
    expect(body.signup).toHaveProperty("key");
    expect(body.signup).toHaveProperty("label");
    expect(body.signup).toHaveProperty("description");
  });

  it("returns 200 with flags keyed by flag key for admin", async () => {
    await adminRequest("/api/feature-flags");
    const res = await getFlags();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body).toHaveProperty("signup");
  });

  it("returns 200 even when unauthenticated (no auth guard on this route)", async () => {
    mockNoAuth();
    const res = await getFlags();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body).toHaveProperty("signup");
  });
});

// ─── PATCH /api/feature-flags/[key] ──────────────────────────
describe("PATCH /api/feature-flags/[key]", () => {
  it("returns 200 and disables a known flag for admin", async () => {
    const req = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key).toBe("signup");
    expect(body.enabled).toBe(false);
  });

  it("updates the DB when disabling a flag", async () => {
    const req = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: false });
    await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });

    const [row] = await prisma.$queryRaw<{ enabled: number }[]>`
      SELECT enabled FROM feature_flags WHERE \`key\` = 'signup'
    `;
    expect(row.enabled).toBe(0);
  });

  it("writes an audit log entry with action FEATURE_FLAG_UPDATED when flag is updated", async () => {
    const req = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: false });
    await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });

    const rows = await prisma.$queryRaw<{ action: string; resource: string }[]>`
      SELECT action, resource FROM audit_logs WHERE action = 'FEATURE_FLAG_UPDATED' LIMIT 1
    `;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].action).toBe("FEATURE_FLAG_UPDATED");
    expect(rows[0].resource).toBe("feature_flags");
  });

  it("returns 200 and enables a known flag for admin", async () => {
    // First disable it
    const req1 = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: false });
    await patchFlag(req1 as any, { params: Promise.resolve({ key: "signup" }) });

    // Then enable it
    const req2 = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: true });
    const res = await patchFlag(req2 as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  it("returns 404 for an unknown flag key", async () => {
    const req = await adminRequest("/api/feature-flags/nonexistent", "PATCH", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when enabled is not a boolean", async () => {
    const req = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: "yes" });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/feature-flags/signup", "PATCH");
    // Need to add body
    const reqWithBody = new Request("http://localhost/api/feature-flags/signup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...Object.fromEntries(req.headers.entries()) },
      body: JSON.stringify({ enabled: false }),
    });
    const res = await patchFlag(reqWithBody as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockNoAuth();
    const req = makeRequest("PATCH", "/api/feature-flags/signup", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(401);
  });
});
