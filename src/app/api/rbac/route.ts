import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { ROLES } from "@/data/nav";

/** GET — returns full permissions matrix: { viewer: ["dashboard"], editor: [...], admin: [...] } */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.$queryRaw<{ role: string; nav_key: string }[]>`
    SELECT role, nav_key FROM role_permissions ORDER BY role, nav_key
  `;

  const result: Record<string, string[]> = {};
  for (const { key } of ROLES) result[key] = [];
  for (const { role, nav_key } of rows) {
    if (!result[role]) result[role] = [];
    result[role].push(nav_key);
  }

  return NextResponse.json(result);
}

/** PUT — replace all permissions for all roles */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const permissions: Record<string, string[]> = await req.json();

  // Delete all existing and re-insert
  await prisma.$executeRaw`DELETE FROM role_permissions`;
  for (const [role, keys] of Object.entries(permissions)) {
    for (const nav_key of keys) {
      await prisma.$executeRaw`
        INSERT INTO role_permissions (role, nav_key) VALUES (${role}, ${nav_key})
      `;
    }
  }

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "RBAC_UPDATED",
    resource: "role_permissions",
    details: permissions,
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
