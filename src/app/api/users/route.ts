import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

interface UserRow {
  id: number; email: string; name: string | null;
  role: string; status: string; created_at: Date;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status, created_at
    FROM users
    ORDER BY FIELD(status,'pending','approved','rejected'), created_at DESC
  `;

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, name, password, role } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const safeRole = role === "admin" ? "admin" : "user";

  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const hash = await hashPassword(password);
  const safeName = name?.trim() || null;

  await prisma.$executeRaw`
    INSERT INTO users (email, password_hash, name, role, status, created_at, updated_at)
    VALUES (${email}, ${hash}, ${safeName}, ${safeRole}, 'approved', NOW(), NOW())
  `;

  const inserted = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "USER_CREATED",
    resource: "users",
    resourceId: inserted[0]?.id,
    details: { email, role: safeRole },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, id: inserted[0]?.id });
}
