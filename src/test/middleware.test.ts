// src/test/middleware.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signToken } from "@/lib/auth";

function req(path: string, token?: string): NextRequest {
  const url = `http://localhost${path}`;
  const headers: Record<string, string> = {};
  if (token) headers["cookie"] = `bp_token=${token}`;
  return new NextRequest(url, { headers });
}

describe("middleware", () => {
  it("passes /login through without a token", async () => {
    const res = await middleware(req("/login"));
    // NextResponse.next() has no Location header
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes /api/auth/login through without a token", async () => {
    const res = await middleware(req("/api/auth/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes /api/auth/signup through without a token", async () => {
    const res = await middleware(req("/api/auth/signup"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes a protected page through when a valid token is present", async () => {
    const token = await signToken({ sub: "1", email: "u@test.com", role: "user", name: null });
    const res = await middleware(req("/", token));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects to /login for a protected page with no token", async () => {
    const res = await middleware(req("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects to /login for a protected page with a tampered token", async () => {
    const res = await middleware(req("/", "bad.token.value"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 JSON for a protected API route with no token", async () => {
    const res = await middleware(req("/api/users"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("passes a protected API route through when a valid token is present", async () => {
    const token = await signToken({ sub: "1", email: "u@test.com", role: "admin", name: null });
    const res = await middleware(req("/api/users", token));
    expect(res.headers.get("location")).toBeNull();
  });
});
