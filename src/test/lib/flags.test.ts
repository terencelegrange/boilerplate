// src/test/lib/flags.test.ts
import { describe, it, expect } from "vitest";
import { isFlagEnabled } from "@/lib/flags";
import { prisma } from "@/lib/prisma";

describe("isFlagEnabled", () => {
  it("returns true for a flag that is enabled", async () => {
    // 'signup' is seeded as enabled in beforeEach
    expect(await isFlagEnabled("signup")).toBe(true);
  });

  it("returns false for a flag that is disabled", async () => {
    await prisma.$executeRaw`UPDATE feature_flags SET enabled = 0 WHERE \`key\` = 'signup'`;
    expect(await isFlagEnabled("signup")).toBe(false);
  });

  it("returns true (fail-open) for an unknown flag key", async () => {
    expect(await isFlagEnabled("nonexistent-flag")).toBe(true);
  });
});
