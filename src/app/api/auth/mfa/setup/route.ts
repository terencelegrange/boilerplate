import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isMfaEnabled, generateMfaSetup } from "@/lib/mfa";

export async function POST() {
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
  const userRows = await prisma.$queryRaw<{ id: number; email: string }[]>`
    SELECT id, email FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { secret, qrCodeDataUrl } = await generateMfaSetup(user.email);

  // Store pending secret (enabled = 0 until verified)
  await prisma.$executeRaw`
    INSERT INTO user_mfa (user_id, secret, enabled, backup_codes, created_at, updated_at)
    VALUES (${userId}, ${secret}, 0, NULL, NOW(), NOW())
    ON DUPLICATE KEY UPDATE secret = ${secret}, updated_at = NOW()
  `;

  return NextResponse.json({
    secret,
    qrCodeDataUrl,
  });
}
