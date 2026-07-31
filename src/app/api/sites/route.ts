import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const env = searchParams.get("env") || "dev";

  try {
    const sites = await prisma.$queryRaw`
      SELECT id, name, url, health_check_url, environment, status, last_checked, created_at, updated_at
      FROM sites
      WHERE environment = ${env}
      ORDER BY name ASC
    `;
    return NextResponse.json(sites);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch sites" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, url, health_check_url, environment } = await req.json();
    if (!name || !url || !health_check_url || !environment) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert site
    await prisma.$executeRaw`
      INSERT INTO sites (name, url, health_check_url, environment, status, created_at, updated_at)
      VALUES (${name}, ${url}, ${health_check_url}, ${environment}, 'unknown', NOW(), NOW())
    `;

    // Fetch the created site to return it
    const created = await prisma.$queryRaw<any[]>`
      SELECT id, name, url, health_check_url, environment, status, last_checked, created_at, updated_at
      FROM sites
      WHERE name = ${name} AND environment = ${environment}
      ORDER BY id DESC
      LIMIT 1
    `;

    const site = created[0];

    // Log audit event
    await auditLog({
      userId: session.sub === "apikey" ? null : Number(session.sub),
      action: "CREATE",
      resource: "sites",
      resourceId: site?.id,
      details: { name, url, health_check_url, environment },
      ip: getIp(req)
    });

    return NextResponse.json(site, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create site" }, { status: 500 });
  }
}
