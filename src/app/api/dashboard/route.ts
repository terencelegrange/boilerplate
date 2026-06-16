import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalUsers]   = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM users`;
  const [pendingUsers] = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM users WHERE status = 'pending'`;
  const [approvedUsers]= await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM users WHERE status = 'approved'`;
  const [auditCount]   = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM audit_logs`;

  const recentUsers = await prisma.$queryRaw<{ id: number; email: string; name: string | null; status: string; created_at: Date }[]>`
    SELECT id, email, name, status, created_at FROM users ORDER BY created_at DESC LIMIT 5
  `;

  return NextResponse.json({
    totalUsers:   Number(totalUsers.c),
    pendingUsers: Number(pendingUsers.c),
    approvedUsers:Number(approvedUsers.c),
    auditCount:   Number(auditCount.c),
    recentUsers,
  });
}
