import { NextRequest, NextResponse } from "next/server";
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
    id: string;
    name: string;
    device_type: string;
    backed_up: number;
    transports: string | null;
    created_at: Date;
    last_used: Date | null;
  }[]>`
    SELECT id, name, device_type, backed_up, transports, created_at, last_used
    FROM passkey_credentials
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({
    credentials: rows.map((r) => ({
      id: r.id,
      name: r.name,
      deviceType: r.device_type,
      backedUp: r.backed_up === 1,
      transports: r.transports ? JSON.parse(r.transports) : [],
      createdAt: r.created_at,
      lastUsed: r.last_used,
    })),
  });
}
