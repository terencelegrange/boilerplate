import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface AuditRow {
  id: number; action: string; resource: string; resource_id: string | null;
  details: string | null; ip: string | null; created_at: Date;
  user_email: string | null; user_name: string | null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const offset = (page - 1) * limit;
  const action = searchParams.get("action") ?? "";

  const rows = action
    ? await prisma.$queryRaw<AuditRow[]>`
        SELECT a.id, a.action, a.resource, a.resource_id, a.details, a.ip, a.created_at,
               u.email AS user_email, u.name AS user_name
        FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
        WHERE a.action = ${action}
        ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    : await prisma.$queryRaw<AuditRow[]>`
        SELECT a.id, a.action, a.resource, a.resource_id, a.details, a.ip, a.created_at,
               u.email AS user_email, u.name AS user_name
        FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `;

  const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM audit_logs`;

  return NextResponse.json({ rows, total: Number(total), page, limit });
}
