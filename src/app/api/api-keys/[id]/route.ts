import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { active } = await req.json();
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  await prisma.$executeRaw`UPDATE api_keys SET active = ${active ? 1 : 0} WHERE id = ${parseInt(id)}`;

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: active ? "API_KEY_ACTIVATED" : "API_KEY_REVOKED",
    resource: "api_keys",
    resourceId: id,
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await prisma.$executeRaw`DELETE FROM api_keys WHERE id = ${parseInt(id)}`;

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "API_KEY_DELETED",
    resource: "api_keys",
    resourceId: id,
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
