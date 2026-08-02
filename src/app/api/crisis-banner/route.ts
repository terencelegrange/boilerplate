import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

interface BannerRow {
  message: string;
  start_date: Date | null;
  end_date: Date | null;
  enabled: number;
}

function toDateString(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function isActive(enabled: boolean, startDate: string | null, endDate: string | null): boolean {
  if (!enabled) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (startDate && today < startDate) return false;
  if (endDate && today > endDate) return false;
  return true;
}

export async function GET() {
  const rows = await prisma.$queryRaw<BannerRow[]>`
    SELECT message, start_date, end_date, enabled FROM crisis_banner WHERE id = 1 LIMIT 1
  `;
  const row = rows[0] ?? { message: "", start_date: null, end_date: null, enabled: 0 };
  const startDate = toDateString(row.start_date);
  const endDate = toDateString(row.end_date);
  const enabled = row.enabled === 1;

  return NextResponse.json({
    message: row.message,
    startDate,
    endDate,
    enabled,
    active: isActive(enabled, startDate, endDate),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { message, startDate, endDate, enabled } = await req.json();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (message !== undefined) { updates.push("message = ?"); values.push(String(message)); }
  if (startDate !== undefined) { updates.push("start_date = ?"); values.push(startDate || null); }
  if (endDate !== undefined) { updates.push("end_date = ?"); values.push(endDate || null); }
  if (enabled !== undefined) { updates.push("enabled = ?"); values.push(enabled ? 1 : 0); }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  updates.push("updated_at = NOW()");

  await prisma.$executeRawUnsafe(
    `UPDATE crisis_banner SET ${updates.join(", ")} WHERE id = 1`,
    ...values
  );

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "CRISIS_BANNER_UPDATED",
    resource: "crisis_banner",
    resourceId: "1",
    details: { message, startDate, endDate, enabled },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
