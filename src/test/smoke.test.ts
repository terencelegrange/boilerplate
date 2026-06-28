// src/test/smoke.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("infrastructure", () => {
  it("connects to the test database", async () => {
    const [{ v }] = await prisma.$queryRaw<{ v: number }[]>`SELECT 1 AS v`;
    expect(v).toBe(1);
  });

  it("feature flags were seeded by beforeEach", async () => {
    const rows = await prisma.$queryRaw<{ key: string }[]>`
      SELECT \`key\` FROM feature_flags ORDER BY \`key\`
    `;
    expect(rows.map((r) => r.key)).toEqual(["dashboard", "menu", "signup"]);
  });
});
