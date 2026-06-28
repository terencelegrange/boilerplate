// src/test/api/me.test.ts
import { describe, it, expect } from "vitest";
import { GET as getProfile, PATCH as patchProfile } from "@/app/api/me/profile/route";
import { PATCH as patchTheme } from "@/app/api/me/theme/route";
import { makeUser, makeRequest, makeToken, mockAuth, mockNoAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── GET /api/me/profile ─────────────────────────────────────
describe("GET /api/me/profile", () => {
  it("returns id, name, email, avatar for authenticated user", async () => {
    const user = await makeUser({ name: "Alice" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const res = await getProfile();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.id);
    expect(body.email).toBe(user.email);
    expect(body.name).toBe("Alice");
    expect("avatar" in body).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getProfile();
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/me/profile — identity ────────────────────────
describe("PATCH /api/me/profile — identity fields", () => {
  it("updates name and re-issues a JWT cookie", async () => {
    const user = await makeUser({ name: "Old Name" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", { name: "New Name" });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bp_token=");

    const [row] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM users WHERE id = ${user.id}
    `;
    expect(row.name).toBe("New Name");
  });

  it("sets a valid avatar (1–127)", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", { avatar: 42 });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ avatar: number }[]>`
      SELECT avatar FROM users WHERE id = ${user.id}
    `;
    expect(row.avatar).toBe(42);
  });

  it("returns 400 when avatar is out of range", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    // avatar 200 is out of range (max 127)
    const req = makeRequest("PATCH", "/api/me/profile", { avatar: 200 });
    const res = await patchProfile(req as any);
    // out-of-range avatar is silently skipped, leaving 0 updates → 400
    expect(res.status).toBe(400);
  });

  it("returns 400 when body has nothing to update", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", {});
    const res = await patchProfile(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/me/profile — password ────────────────────────
describe("PATCH /api/me/profile — password change", () => {
  it("changes the password when current password is correct", async () => {
    const user = await makeUser({ password: "oldpassword" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", {
      currentPassword: "oldpassword",
      newPassword: "newpassword123",
    });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(200);

    // Verify new password hash is stored
    const [row] = await prisma.$queryRaw<{ password_hash: string }[]>`
      SELECT password_hash FROM users WHERE id = ${user.id}
    `;
    const { verifyPassword } = await import("@/lib/initDb");
    expect(await verifyPassword("newpassword123", row.password_hash)).toBe(true);
    expect(await verifyPassword("oldpassword", row.password_hash)).toBe(false);
  });

  it("returns 400 when current password is wrong", async () => {
    const user = await makeUser({ password: "correctpassword" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", {
      currentPassword: "wrongpassword",
      newPassword: "newpassword123",
    });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is provided without currentPassword", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", { newPassword: "newpassword123" });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/me/theme ─────────────────────────────────────
describe("PATCH /api/me/theme", () => {
  it("sets theme to dark and sets bp_theme cookie", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "dark" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bp_theme=dark");
  });

  it("sets theme to light", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "light" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bp_theme=light");
  });

  it("returns 400 for an invalid theme value", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "solarized" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "dark" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(401);
  });
});
