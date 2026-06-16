import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "./prisma";

export const COOKIE = "bp_token";
export const THEME_COOKIE = "bp_theme";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-me"
);

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string | null;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

async function getSessionFromApiKey(rawKey: string): Promise<JwtPayload | null> {
  try {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const rows = await prisma.$queryRaw<{
      id: number; active: number; expires_at: Date | null;
    }[]>`
      SELECT id, active, expires_at FROM api_keys
      WHERE key_hash = ${keyHash} AND active = 1
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    if (!rows[0]) return null;

    // Update last_used (fire and forget)
    prisma.$executeRaw`UPDATE api_keys SET last_used = NOW() WHERE id = ${rows[0].id}`.catch(() => {});

    // API keys get admin-level access
    return { sub: "apikey", email: "api", role: "admin", name: null };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  // 1. Check Authorization: Bearer header (API key support)
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer bp_")) {
    const rawKey = authHeader.slice(7);
    const session = await getSessionFromApiKey(rawKey);
    if (session) return session;
  }

  // 2. Fall back to cookie-based JWT
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
