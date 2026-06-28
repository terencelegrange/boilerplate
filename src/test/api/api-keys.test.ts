// src/test/api/api-keys.test.ts
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { GET as getKeys, POST as createKey } from "@/app/api/api-keys/route";
import { PATCH as patchKey, DELETE as deleteKey } from "@/app/api/api-keys/[id]/route";
import { makeRequest, makeAdmin, makeToken, mockAuth, adminRequest, userRequest } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── GET /api/api-keys ───────────────────────────────────────
describe("GET /api/api-keys", () => {
  it("returns an array of key metadata for admin", async () => {
    await adminRequest("/api/api-keys");
    const res = await getKeys();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("active field is returned as a boolean", async () => {
    // Seed a key then verify GET returns active as boolean
    const admin = await makeAdmin();
    const rawKey = "bp_" + "f".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Bool Test Key', 'bool@test.com', ${admin.id}, NOW(), 1)
    `;
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const res = await getKeys();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const key = body.find((k: any) => k.prefix === prefix);
    expect(key).toBeDefined();
    expect(typeof key.active).toBe("boolean");
    expect(key.active).toBe(true);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/api-keys");
    const res = await getKeys();
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getKeys();
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/api-keys ──────────────────────────────────────
describe("POST /api/api-keys", () => {
  it("creates a key and returns raw key with prefix; raw key is not stored", async () => {
    const req = await adminRequest("/api/api-keys", "POST", {
      name: "Test Key",
      contact: "dev@test.com",
    });
    const res = await createKey(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key).toMatch(/^bp_[a-f0-9]{32}$/);
    expect(body.prefix).toBe(body.key.slice(0, 12));

    // Verify raw key is not in DB — only hash
    const rows = await prisma.$queryRaw<{ key_hash: string }[]>`
      SELECT key_hash FROM api_keys WHERE prefix = ${body.prefix}
    `;
    expect(rows[0].key_hash).not.toBe(body.key);
    expect(rows[0].key_hash).toHaveLength(64); // SHA256 hex = 64 chars
  });

  it("returns 400 when name is missing", async () => {
    const req = await adminRequest("/api/api-keys", "POST", { contact: "dev@test.com" });
    const res = await createKey(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when contact is missing", async () => {
    const req = await adminRequest("/api/api-keys", "POST", { name: "Test Key" });
    const res = await createKey(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/api-keys", "POST", { name: "k", contact: "c" });
    const res = await createKey(req as any);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/api-keys/[id] ────────────────────────────────
describe("PATCH /api/api-keys/[id]", () => {
  async function seedKey(adminId: number, uniqueChar: string): Promise<number> {
    const rawKey = "bp_" + uniqueChar.repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Seed Key', 'seed@test.com', ${adminId}, NOW(), 1)
    `;
    const [row] = await prisma.$queryRaw<{ id: number | bigint }[]>`
      SELECT id FROM api_keys WHERE prefix = ${prefix}
    `;
    return Number(row.id);
  }

  it("revokes an active key (active → false)", async () => {
    const admin = await makeAdmin();
    const keyId = await seedKey(admin.id, "d");
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/api-keys/${keyId}`, { active: false });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ active: number }[]>`
      SELECT active FROM api_keys WHERE id = ${keyId}
    `;
    expect(row.active).toBe(0);
  });

  it("re-enables a revoked key (active → true)", async () => {
    const admin = await makeAdmin();
    const keyId = await seedKey(admin.id, "c");
    await prisma.$executeRaw`UPDATE api_keys SET active = 0 WHERE id = ${keyId}`;
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/api-keys/${keyId}`, { active: true });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ active: number }[]>`
      SELECT active FROM api_keys WHERE id = ${keyId}
    `;
    expect(row.active).toBe(1);
  });

  it("returns 400 when active is not a boolean", async () => {
    const admin = await makeAdmin();
    const keyId = await seedKey(admin.id, "b");
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/api-keys/${keyId}`, { active: "yes" });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/api-keys/1", "PATCH", { active: false });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/api-keys/[id] ───────────────────────────────
describe("DELETE /api/api-keys/[id]", () => {
  it("deletes an API key", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "e".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Del Key', 'del@test.com', ${admin.id}, NOW(), 1)
    `;
    const [row] = await prisma.$queryRaw<{ id: number | bigint }[]>`
      SELECT id FROM api_keys WHERE prefix = ${prefix}
    `;
    const keyId = Number(row.id);

    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("DELETE", `/api/api-keys/${keyId}`);
    const res = await deleteKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(200);

    const remaining = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM api_keys WHERE id = ${keyId}
    `;
    expect(remaining.length).toBe(0);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/api-keys/1", "DELETE");
    const res = await deleteKey(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });
});
