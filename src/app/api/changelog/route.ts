import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initDb();

  const entries = await prisma.$queryRaw<{ id: number; date: string; description: string }[]>`
    SELECT id, DATE_FORMAT(\`date\`, '%Y-%m-%d') AS \`date\`, description
    FROM changelog
    ORDER BY \`date\` DESC, id DESC
  `;

  return NextResponse.json(entries);
}
