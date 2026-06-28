// src/test/api/misc.test.ts
import { describe, it, expect } from "vitest";
import { GET as getChangelog } from "@/app/api/changelog/route";
import { GET as getOpenApi } from "@/app/api/openapi/route";
import { adminRequest, userRequest } from "../helpers";
import { prisma } from "@/lib/prisma";

describe("GET /api/changelog", () => {
  it("returns changelog entries ordered by date DESC for authenticated user", async () => {
    await prisma.$executeRaw`
      INSERT INTO changelog (date, description) VALUES
      ('2026-01-01', 'First entry'),
      ('2026-06-01', 'Second entry')
    `;
    const { req } = await userRequest("/api/changelog");
    const res = await getChangelog();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    // Most recent first
    expect(body[0].date >= body[1].date).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getChangelog();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/openapi", () => {
  it("returns a spec with openapi and paths keys for authenticated user", async () => {
    const { req } = await userRequest("/api/openapi");
    const res = await getOpenApi();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toMatch(/^3\./);
    expect(typeof body.paths).toBe("object");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getOpenApi();
    expect(res.status).toBe(401);
  });
});
