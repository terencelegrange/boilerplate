// src/test/api/rbac.test.ts
import { describe, it, expect } from "vitest";
import { GET as getRbac, PUT as putRbac } from "@/app/api/rbac/route";
import { GET as getMyRbac } from "@/app/api/rbac/me/route";
import { makeUser, makeRequest, adminRequest, userRequest, makeToken, mockAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

describe("GET /api/rbac", () => {
  it("returns full permissions matrix for admin", async () => {
    // Seed some permissions
    await prisma.$executeRaw`INSERT INTO role_permissions (role, nav_key) VALUES ('admin', 'dashboard'), ('viewer', 'dashboard')`;
    const req = await adminRequest("/api/rbac");
    const res = await getRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.admin)).toBe(true);
    expect(Array.isArray(body.viewer)).toBe(true);
    expect(Array.isArray(body.editor)).toBe(true);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/rbac");
    const res = await getRbac();
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getRbac();
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/rbac", () => {
  it("replaces all permissions and writes an audit log", async () => {
    const req = await adminRequest("/api/rbac", "PUT", {
      viewer: ["dashboard"],
      editor: ["dashboard", "settings"],
      admin: ["dashboard", "settings"],
    });
    const res = await putRbac(req as any);
    expect(res.status).toBe(200);

    const rows = await prisma.$queryRaw<{ role: string; nav_key: string }[]>`
      SELECT role, nav_key FROM role_permissions ORDER BY role, nav_key
    `;
    const adminKeys = rows.filter((r) => r.role === "admin").map((r) => r.nav_key).sort();
    expect(adminKeys).toEqual(["dashboard", "settings"]);

    const auditRows = await prisma.$queryRaw<{ action: string }[]>`
      SELECT action FROM audit_logs WHERE action = 'RBAC_UPDATED' LIMIT 1
    `;
    expect(auditRows.length).toBe(1);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/rbac", "PUT", { viewer: [] });
    const res = await putRbac(req as any);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/rbac/me", () => {
  it("returns viewer nav keys for a user with role=user (legacy mapping)", async () => {
    await prisma.$executeRaw`INSERT INTO role_permissions (role, nav_key) VALUES ('viewer', 'dashboard')`;
    const user = await makeUser({ role: "user" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const res = await getMyRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("viewer");
    expect(body.navKeys).toContain("dashboard");
  });

  it("returns admin nav keys for an admin", async () => {
    await prisma.$executeRaw`INSERT INTO role_permissions (role, nav_key) VALUES ('admin', 'dashboard'), ('admin', 'settings')`;
    const admin = await makeUser({ role: "admin" });
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const res = await getMyRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
    expect(body.navKeys).toContain("dashboard");
  });

  it("falls back to DEFAULT_ROLE_PERMISSIONS when role_permissions table is empty", async () => {
    // Table is empty after beforeEach truncate
    const user = await makeUser({ role: "user" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const res = await getMyRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.navKeys).toContain("dashboard");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getMyRbac();
    expect(res.status).toBe(401);
  });
});
