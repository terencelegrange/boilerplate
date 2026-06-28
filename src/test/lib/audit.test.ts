// src/test/lib/audit.test.ts
import { describe, it, expect, vi } from "vitest";
import { auditLog, getIp } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

describe("auditLog", () => {
  it("inserts a row with the correct action and resource", async () => {
    await auditLog({ action: "TEST_ACTION", resource: "test_resource" });

    const rows = await prisma.$queryRaw<{ action: string; resource: string }[]>`
      SELECT action, resource FROM audit_logs LIMIT 1
    `;
    expect(rows[0].action).toBe("TEST_ACTION");
    expect(rows[0].resource).toBe("test_resource");
  });

  it("never throws even when the DB call fails", async () => {
    vi.spyOn(prisma, "$executeRaw").mockRejectedValueOnce(new Error("DB error"));
    await expect(
      auditLog({ action: "FAIL_ACTION", resource: "test" })
    ).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});

describe("getIp", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getIp(req as any)).toBe("1.2.3.4");
  });

  it("returns null when the header is absent", () => {
    const req = new Request("http://localhost/");
    expect(getIp(req as any)).toBeNull();
  });
});
