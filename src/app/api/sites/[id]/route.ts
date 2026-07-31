import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await initDb();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const siteId = Number(id);
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
    }

    const { name, url, health_check_url, environment } = await req.json();

    // Check if site exists
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM sites WHERE id = ${siteId} LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Build update dynamic parts - since it's raw SQL, we can construct it or just update all fields
    // Because we are modifying sites settings, we can update whatever is passed, or update all fields (most inputs pass all fields anyway).
    // Updating all fields that are present:
    await prisma.$executeRaw`
      UPDATE sites
      SET name = COALESCE(${name}, name),
          url = COALESCE(${url}, url),
          health_check_url = COALESCE(${health_check_url}, health_check_url),
          environment = COALESCE(${environment}, environment),
          updated_at = NOW()
      WHERE id = ${siteId}
    `;

    // Fetch updated site
    const updated = await prisma.$queryRaw<any[]>`
      SELECT id, name, url, health_check_url, environment, status, last_checked, created_at, updated_at
      FROM sites
      WHERE id = ${siteId}
      LIMIT 1
    `;

    const site = updated[0];

    // Audit log
    await auditLog({
      userId: session.sub === "apikey" ? null : Number(session.sub),
      action: "UPDATE",
      resource: "sites",
      resourceId: siteId,
      details: { name, url, health_check_url, environment },
      ip: getIp(req)
    });

    return NextResponse.json(site);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update site" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await initDb();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const siteId = Number(id);
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
    }

    // Fetch site details for audit logging before deletion
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, name, url, environment FROM sites WHERE id = ${siteId} LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const site = existing[0];

    // Delete site (foreign key constraint will cascade delete health_check_logs)
    await prisma.$executeRaw`
      DELETE FROM sites WHERE id = ${siteId}
    `;

    // Audit log
    await auditLog({
      userId: session.sub === "apikey" ? null : Number(session.sub),
      action: "DELETE",
      resource: "sites",
      resourceId: siteId,
      details: { name: site.name, url: site.url, environment: site.environment },
      ip: getIp(req)
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete site" }, { status: 500 });
  }
}
