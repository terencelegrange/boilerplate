import { NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  await initDb();
  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const rows = await prisma.$queryRaw<{
    enabled: number;
    backup_codes: string | null;
    created_at: Date;
    updated_at: Date;
  }[]>`
    SELECT enabled, backup_codes, created_at, updated_at FROM user_mfa WHERE user_id = ${userId} LIMIT 1
  `;

  if (rows.length === 0 || rows[0].enabled !== 1) {
    return NextResponse.json({
      enabled: false,
      backupCodesRemaining: 0,
      createdAt: null,
    });
  }

  let remaining = 0;
  try {
    if (rows[0].backup_codes) {
      const parsed = JSON.parse(rows[0].backup_codes);
      if (Array.isArray(parsed)) remaining = parsed.length;
    }
  } catch {}

  return NextResponse.json({
    enabled: true,
    backupCodesRemaining: remaining,
    createdAt: rows[0].created_at,
    updatedAt: rows[0].updated_at,
  });
}
