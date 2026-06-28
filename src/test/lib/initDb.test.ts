// src/test/lib/initDb.test.ts
import { describe, it, expect } from "vitest";
import { initDb, hashPassword, verifyPassword } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";

describe("initDb", () => {
  it("is idempotent — second call does not throw", async () => {
    // initialized flag is already true from beforeAll in setup.ts
    await expect(initDb()).resolves.toBeUndefined();
  });

  it("does not duplicate feature flags when called again", async () => {
    await initDb(); // no-op due to initialized flag
    const [{ cnt }] = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM feature_flags
    `;
    expect(Number(cnt)).toBe(3);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("produces a hash that is not the plaintext", async () => {
    const hash = await hashPassword("mysecret");
    expect(hash).not.toBe("mysecret");
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
