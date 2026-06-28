// src/test/api/auth.test.ts
import { describe, it, expect } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { makeUser, makeRequest, mockAuth, makeToken } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── Login ──────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("returns 200 and sets bp_token cookie on valid credentials", async () => {
    const user = await makeUser({ status: "approved" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    const res = await login(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("bp_token=");
  });

  it("returns 401 for a wrong password", async () => {
    const user = await makeUser({ status: "approved" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: "wrongpassword",
    });
    const res = await login(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown email", async () => {
    const req = makeRequest("POST", "/api/auth/login", {
      email: "nobody@test.com",
      password: "password123",
    });
    const res = await login(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a pending user", async () => {
    const user = await makeUser({ status: "pending" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    const res = await login(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a rejected user", async () => {
    const user = await makeUser({ status: "rejected" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    const res = await login(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 400 when email or password is missing", async () => {
    const req = makeRequest("POST", "/api/auth/login", { email: "x@test.com" });
    const res = await login(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── Logout ─────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("returns 200 and clears bp_token cookie", async () => {
    const user = await makeUser();
    const token = await makeToken({
      sub: String(user.id),
      email: user.email,
      role: "user",
      name: user.name,
    });
    mockAuth(token);
    const req = makeRequest("POST", "/api/auth/logout");
    const res = await logout(req as any);
    expect(res.status).toBe(200);
    // Cookie should be cleared (maxAge=0)
    expect(res.headers.get("set-cookie")).toContain("bp_token=;");
  });

  it("returns 200 even when unauthenticated", async () => {
    // mockNoAuth is set by beforeEach
    const req = makeRequest("POST", "/api/auth/logout");
    const res = await logout(req as any);
    expect(res.status).toBe(200);
  });
});

// ─── Signup ─────────────────────────────────────────────────
describe("POST /api/auth/signup", () => {
  it("returns 200 and creates a pending user", async () => {
    const req = makeRequest("POST", "/api/auth/signup", {
      email: "newuser@test.com",
      password: "password123",
      name: "New User",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(200);

    const rows = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM users WHERE email = 'newuser@test.com' LIMIT 1
    `;
    expect(rows[0].status).toBe("pending");
  });

  it("returns 423 when signup flag is disabled", async () => {
    await prisma.$executeRaw`UPDATE feature_flags SET enabled = 0 WHERE \`key\` = 'signup'`;
    const req = makeRequest("POST", "/api/auth/signup", {
      email: "blocked@test.com",
      password: "password123",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(423);
  });

  it("returns 409 for a duplicate email", async () => {
    const user = await makeUser({ email: "existing@test.com" });
    const req = makeRequest("POST", "/api/auth/signup", {
      email: user.email,
      password: "password123",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(409);
  });

  it("returns 400 when password is under 8 characters", async () => {
    const req = makeRequest("POST", "/api/auth/signup", {
      email: "short@test.com",
      password: "abc",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = makeRequest("POST", "/api/auth/signup", { password: "password123" });
    const res = await signup(req as any);
    expect(res.status).toBe(400);
  });
});
