// src/test/lib/auth.test.ts
import { describe, it, expect, vi } from "vitest";
import { signToken, verifyToken, getSession } from "@/lib/auth";
import { makeToken, mockAuth, mockNoAuth, makeUser, makeAdmin } from "../helpers";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { cookies, headers } from "next/headers";

describe("signToken / verifyToken", () => {
  it("round-trips a payload", async () => {
    const payload = { sub: "1", email: "a@test.com", role: "admin", name: "Alice" };
    const token = await signToken(payload);
    expect(typeof token).toBe("string");
    const decoded = await verifyToken(token);
    expect(decoded?.sub).toBe("1");
    expect(decoded?.email).toBe("a@test.com");
    expect(decoded?.role).toBe("admin");
    expect(decoded?.name).toBe("Alice");
  });

  it("returns null for a tampered token", async () => {
    const token = await signToken({ sub: "1", email: "a@test.com", role: "user", name: null });
    expect(await verifyToken(token + "x")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await verifyToken("")).toBeNull();
  });
});

describe("getSession — cookie path", () => {
  it("returns null when no cookie is set", async () => {
    // beforeEach already sets mockNoAuth via setup.ts
    expect(await getSession()).toBeNull();
  });

  it("returns payload when a valid bp_token cookie is present", async () => {
    const token = await makeToken({ sub: "42", email: "b@test.com", role: "admin", name: "Bob" });
    mockAuth(token);
    const session = await getSession();
    expect(session?.sub).toBe("42");
    expect(session?.email).toBe("b@test.com");
    expect(session?.role).toBe("admin");
  });

  it("returns null when the cookie contains an invalid token", async () => {
    mockAuth("not.a.valid.jwt");
    expect(await getSession()).toBeNull();
  });
});

describe("getSession — API key path", () => {
  it("returns admin session for an active unexpired key and updates last_used", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "a".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);

    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Test Key', 'test@test.com', ${admin.id}, NOW(), 1)
    `;

    // Pass the key via Authorization: Bearer header
    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: `Bearer ${rawKey}` }) as any
    );
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    const session = await getSession();
    expect(session?.role).toBe("admin");
    expect(session?.sub).toBe("apikey");

    // last_used should be set (eventually, it's fire-and-forget — wait briefly)
    await new Promise((r) => setTimeout(r, 100));
    const [row] = await prisma.$queryRaw<{ last_used: Date | null }[]>`
      SELECT last_used FROM api_keys WHERE prefix = ${prefix}
    `;
    expect(row.last_used).not.toBeNull();
  });

  it("returns null for a revoked API key", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "b".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);

    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Revoked Key', 'test@test.com', ${admin.id}, NOW(), 0)
    `;

    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: `Bearer ${rawKey}` }) as any
    );
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    expect(await getSession()).toBeNull();
  });

  it("returns null for an expired API key", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "c".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    const past = new Date(Date.now() - 1000);

    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, expires_at, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Expired Key', 'test@test.com', ${past}, ${admin.id}, NOW(), 1)
    `;

    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: `Bearer ${rawKey}` }) as any
    );
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    expect(await getSession()).toBeNull();
  });
});
