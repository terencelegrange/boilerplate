// src/test/api/users.test.ts
import { describe, it, expect } from "vitest";
import { GET as getUsers } from "@/app/api/users/route";
import { PATCH as patchUser, DELETE as deleteUser } from "@/app/api/users/[id]/route";
import { makeUser, makeAdmin, makeRequest, adminRequest, userRequest, makeToken, mockAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

// --- GET /api/users -----------------------------------------------------------
describe("GET /api/users", () => {
  it("returns 200 with a user array for admin", async () => {
    await makeUser();
    await makeUser();
    await adminRequest("/api/users");
    const res = await getUsers();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body[0]).toHaveProperty("email");
    expect(body[0]).toHaveProperty("status");
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/users");
    const res = await getUsers();
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    // beforeEach resets auth to mockNoAuth
    const res = await getUsers();
    expect(res.status).toBe(403);
  });
});

// --- PATCH /api/users/[id] ----------------------------------------------------
describe("PATCH /api/users/[id]", () => {
  it("approves a pending user", async () => {
    const pending = await makeUser({ status: "pending" });
    const req = await adminRequest(`/api/users/${pending.id}`, "PATCH", { status: "approved" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(pending.id) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM users WHERE id = ${pending.id}
    `;
    expect(row.status).toBe("approved");
  });

  it("changes the role of a user", async () => {
    const user = await makeUser();
    const req = await adminRequest(`/api/users/${user.id}`, "PATCH", { role: "admin" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(user.id) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ role: string }[]>`
      SELECT role FROM users WHERE id = ${user.id}
    `;
    expect(row.role).toBe("admin");
  });

  it("returns 400 when trying to modify own account", async () => {
    const admin = await makeAdmin();
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/users/${admin.id}`, { status: "rejected" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(admin.id) }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const target = await makeUser();
    const { req } = await userRequest(`/api/users/${target.id}`, "PATCH", { status: "approved" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(target.id) }) });
    expect(res.status).toBe(403);
  });
});

// --- DELETE /api/users/[id] ---------------------------------------------------
describe("DELETE /api/users/[id]", () => {
  it("deletes another user", async () => {
    const target = await makeUser();
    const req = await adminRequest(`/api/users/${target.id}`, "DELETE");
    const res = await deleteUser(req as any, { params: Promise.resolve({ id: String(target.id) }) });
    expect(res.status).toBe(200);

    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM users WHERE id = ${target.id}`;
    expect(rows.length).toBe(0);
  });

  it("returns 400 when trying to delete own account", async () => {
    const admin = await makeAdmin();
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("DELETE", `/api/users/${admin.id}`);
    const res = await deleteUser(req as any, { params: Promise.resolve({ id: String(admin.id) }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const target = await makeUser();
    const { req } = await userRequest(`/api/users/${target.id}`, "DELETE");
    const res = await deleteUser(req as any, { params: Promise.resolve({ id: String(target.id) }) });
    expect(res.status).toBe(403);
  });
});
