// src/test/api/health.test.ts
import { describe, it, expect } from "vitest";
import { GET as health } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with all checks ok when the database is reachable", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.server.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(typeof body.checks.database.latencyMs).toBe("number");
    expect(body.checks.tables.status).toBe("ok");
    expect(body.checks.tables.checked).toBeGreaterThan(0);
    expect(typeof body.timestamp).toBe("string");
  });
});
