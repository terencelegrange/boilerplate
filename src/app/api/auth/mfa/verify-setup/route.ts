import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp, getUserAgent, parseUserAgent } from "@/lib/audit";
import { isMfaEnabled, verifyTotpToken, generateBackupCodes } from "@/lib/mfa";

export async function POST(req: NextRequest) {
  await initDb();

  const mfaActive = await isMfaEnabled();
  if (!mfaActive) {
    return NextResponse.json({ error: "Multi-Factor Authentication is currently disabled system-wide" }, { status: 403 });
  }

  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const body = await req.json();
  const code = String(body.code || "").trim();

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Please enter a valid 6-digit verification code" }, { status: 400 });
  }

  const mfaRows = await prisma.$queryRaw<{ secret: string; enabled: number }[]>`
    SELECT secret, enabled FROM user_mfa WHERE user_id = ${userId} LIMIT 1
  `;

  if (mfaRows.length === 0) {
    return NextResponse.json({ error: "MFA setup has not been initiated. Please generate a QR code first." }, { status: 400 });
  }

  const mfa = mfaRows[0];
  const isValid = verifyTotpToken(mfa.secret, code);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid 6-digit verification code. Please try again." }, { status: 400 });
  }

  const { plainCodes, hashedCodes } = generateBackupCodes(8);

  await prisma.$executeRaw`
    UPDATE user_mfa
    SET enabled = 1, backup_codes = ${JSON.stringify(hashedCodes)}, updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  const ua = getUserAgent(req);
  const parsed = parseUserAgent(ua);

  await auditLog({
    userId,
    action: "MFA_ENABLED",
    resource: "user_mfa",
    details: { method: "totp_authenticator", browser: parsed.browser, os: parsed.os },
    ip: getIp(req),
  });

  return NextResponse.json({
    ok: true,
    backupCodes: plainCodes,
  });
}
