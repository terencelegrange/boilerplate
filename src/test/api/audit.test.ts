// src/test/api/audit.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAudit } from "@/app/api/audit/route";
import { auditLog } from "@/lib/audit";
import { adminRequest, userRequest, mockNoAuth } from "../helpers";

function makeAuditRequest(url: string, headers: Headers): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "GET",
    headers,
  });
}

// ─── GET /api/audit ───────────────────────────────────────────
describe("GET /api/audit", () => {
  it("returns 200 with rows/total/page/limit for admin", async () => {
    await auditLog({ action: "LOGIN", resource: "sessions" });
    await auditLog({ action: "LOGIN", resource: "sessions" });
    const req = await adminRequest("/api/audit?page=1&limit=10");
    const res = await getAudit(
      makeAuditRequest("/api/audit?page=1&limit=10", req.headers as any)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows.length).toBeGreaterThanOrEqual(2);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/audit");
    const res = await getAudit(
      makeAuditRequest("/api/audit", new Headers())
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    mockNoAuth();
    const res = await getAudit(
      makeAuditRequest("/api/audit", new Headers())
    );
    expect(res.status).toBe(403);
  });

  it("filters rows by action query param", async () => {
    await auditLog({ action: "LOGIN", resource: "sessions" });
    await auditLog({ action: "LOGOUT", resource: "sessions" });
    const req = await adminRequest("/api/audit?action=LOGIN");
    const res = await getAudit(
      makeAuditRequest("/api/audit?action=LOGIN", req.headers as any)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.every((r: any) => r.action === "LOGIN")).toBe(true);
  });

  it("respects page and limit params", async () => {
    for (let i = 0; i < 5; i++) {
      await auditLog({ action: "LOGIN", resource: "sessions" });
    }
    const req = await adminRequest("/api/audit?page=1&limit=2");
    const res = await getAudit(
      makeAuditRequest("/api/audit?page=1&limit=2", req.headers as any)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.length).toBeLessThanOrEqual(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
  });

  it("each row has expected fields", async () => {
    await auditLog({ action: "LOGIN", resource: "sessions" });
    const req = await adminRequest("/api/audit");
    const res = await getAudit(
      makeAuditRequest("/api/audit", req.headers as any)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.length).toBeGreaterThan(0);
    const row = body.rows[0];
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("action");
    expect(row).toHaveProperty("resource");
    expect(row).toHaveProperty("created_at");
  });
});
