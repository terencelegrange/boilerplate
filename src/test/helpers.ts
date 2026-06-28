// src/test/helpers.ts
import { vi } from "vitest";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { hashPassword } from "@/lib/initDb";
import type { JwtPayload } from "@/lib/auth";

export interface TestUser {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  password: string;
}

export async function makeUser(
  overrides: Partial<{
    email: string;
    name: string;
    role: string;
    status: string;
    password: string;
  }> = {}
): Promise<TestUser> {
  const password = overrides.password ?? "password123";
  const email =
    overrides.email ??
    `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const name = overrides.name ?? "Test User";
  const role = overrides.role ?? "user";
  const status = overrides.status ?? "approved";
  const hash = await hashPassword(password);

  await prisma.$executeRaw`
    INSERT INTO users (email, password_hash, name, role, status, theme, created_at, updated_at)
    VALUES (${email}, ${hash}, ${name}, ${role}, ${status}, 'light', NOW(), NOW())
  `;
  const [row] = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  return { id: row.id, email, name, role, status, password };
}

export async function makeAdmin(
  overrides: Partial<{ email: string; name: string; password: string }> = {}
): Promise<TestUser> {
  return makeUser({ role: "admin", status: "approved", ...overrides });
}

export async function makeToken(payload: JwtPayload): Promise<string> {
  return signToken(payload);
}

export function mockAuth(token: string): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === "bp_token" ? { value: token } : undefined,
  } as any);
  vi.mocked(headers).mockResolvedValue(new Headers() as any);
}

export function mockNoAuth(): void {
  vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);
  vi.mocked(headers).mockResolvedValue(new Headers() as any);
}

export function makeRequest(
  method: string,
  url: string,
  body?: unknown
): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function adminRequest(
  url: string,
  method = "GET",
  body?: unknown
): Promise<Request> {
  const admin = await makeAdmin();
  const token = await makeToken({
    sub: String(admin.id),
    email: admin.email,
    role: "admin",
    name: admin.name,
  });
  mockAuth(token);
  return makeRequest(method, url, body);
}

export async function userRequest(
  url: string,
  method = "GET",
  body?: unknown
): Promise<{ req: Request; user: TestUser }> {
  const user = await makeUser();
  const token = await makeToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name,
  });
  mockAuth(token);
  return { req: makeRequest(method, url, body), user };
}
