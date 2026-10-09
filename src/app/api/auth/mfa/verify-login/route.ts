import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { verifyToken, signToken, createDeviceToken, COOKIE, THEME_COOKIE } from "@/lib/auth";
import { auditLog, getIp, getUserAgent, parseUserAgent } from "@/lib/audit";
import { verifyTotpToken, hashBackupCode } from "@/lib/mfa";

interface UserRow {
  id: number;
  email: string;
  role: string;
  status: string;
  theme: string;
  name: string | null;
  avatar: number | null;
}

export async function POST(req: NextRequest) {
  await initDb();
  const body = await req.json();
  const { mfaToken, code, isBackupCode, trustDevice } = body;

  if (!mfaToken || !code) {
    return NextResponse.json({ error: "MFA challenge token and verification code are required" }, { status: 400 });
  }

  const payload = await verifyToken(mfaToken);
  if (!payload || (payload as any).type !== "mfa_pending") {
    return NextResponse.json({ error: "MFA session expired or invalid. Please sign in again." }, { status: 401 });
  }

  const userId = Number(payload.sub);
  const userRows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, role, status, theme, name, avatar FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.status === "pending" || user.status === "rejected") {
    return NextResponse.json({ error: "Account access restricted" }, { status: 403 });
  }

  const mfaRows = await prisma.$queryRaw<{ secret: string; enabled: number; backup_codes: string | null }[]>`
    SELECT secret, enabled, backup_codes FROM user_mfa WHERE user_id = ${userId} LIMIT 1
  `;

  if (mfaRows.length === 0 || mfaRows[0].enabled !== 1) {
    return NextResponse.json({ error: "MFA is not configured for this account" }, { status: 400 });
  }

  const mfa = mfaRows[0];
  const cleanCode = String(code).trim();
  const ua = getUserAgent(req);
  const parsed = parseUserAgent(ua);
  let authMethod = "totp_authenticator";

  if (isBackupCode) {
    const hashed = hashBackupCode(cleanCode);
    let remainingCodes: string[] = [];
    try {
      if (mfa.backup_codes) remainingCodes = JSON.parse(mfa.backup_codes);
    } catch {}

    const index = remainingCodes.indexOf(hashed);
    if (index === -1) {
      await auditLog({
        userId: user.id,
        action: "LOGIN_MFA_FAILED",
        resource: "sessions",
        details: { method: "backup_code", reason: "invalid_code", browser: parsed.browser, os: parsed.os },
        ip: getIp(req),
      });
      return NextResponse.json({ error: "Invalid or already-used emergency backup code" }, { status: 401 });
    }

    // Consume backup code
    remainingCodes.splice(index, 1);
    await prisma.$executeRaw`
      UPDATE user_mfa SET backup_codes = ${JSON.stringify(remainingCodes)}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    authMethod = "mfa_backup_code";
  } else {
    const valid = verifyTotpToken(mfa.secret, cleanCode);
    if (!valid) {
      await auditLog({
        userId: user.id,
        action: "LOGIN_MFA_FAILED",
        resource: "sessions",
        details: { method: "totp_authenticator", reason: "invalid_code", browser: parsed.browser, os: parsed.os },
        ip: getIp(req),
      });
      return NextResponse.json({ error: "Invalid 6-digit authenticator code" }, { status: 401 });
    }
  }

  // Update user last login
  await prisma.$executeRaw`UPDATE users SET updated_at = NOW() WHERE id = ${user.id}`.catch(() => {});

  const token = await signToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  await auditLog({
    userId: user.id,
    action: "LOGIN_MFA",
    resource: "sessions",
    details: { method: authMethod, browser: parsed.browser, os: parsed.os, userAgent: ua },
    ip: getIp(req),
  });

  const deviceToken = trustDevice ? await createDeviceToken(user.id) : undefined;
  if (deviceToken) {
    await auditLog({ userId: user.id, action: "DEVICE_TRUSTED", resource: "device_tokens", ip: getIp(req) });
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role },
    ...(deviceToken ? { deviceToken } : {}),
  });

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set(THEME_COOKIE, user.theme || "dark", {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
