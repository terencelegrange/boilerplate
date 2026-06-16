import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
