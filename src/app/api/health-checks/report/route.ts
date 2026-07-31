import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";

export async function POST(req: NextRequest) {
  await initDb();
  
  // Authenticate the request (supports session or API key)
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only editors and admins can report health statuses
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { siteId, status, statusCode, latency, error } = await req.json();

    if (!siteId || !status) {
      return NextResponse.json({ error: "Missing required fields: siteId and status are required" }, { status: 400 });
    }

    if (status !== "up" && status !== "down") {
      return NextResponse.json({ error: "Invalid status: must be 'up' or 'down'" }, { status: 400 });
    }

    // Check if site exists
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM sites WHERE id = ${Number(siteId)} LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const targetSiteId = Number(siteId);
    const parsedLatency = latency != null ? Number(latency) : null;
    const parsedStatusCode = statusCode != null ? Number(statusCode) : null;
    const errorMsg = error || null;

    // 1. Insert into health_check_logs
    await prisma.$executeRaw`
      INSERT INTO health_check_logs (site_id, status, status_code, latency, error, created_at)
      VALUES (${targetSiteId}, ${status}, ${parsedStatusCode}, ${parsedLatency}, ${errorMsg}, NOW())
    `;

    // 2. Update site status and last_checked
    await prisma.$executeRaw`
      UPDATE sites
      SET status = ${status},
          last_checked = NOW()
      WHERE id = ${targetSiteId}
    `;

    return NextResponse.json({ success: true, message: "Health check report recorded successfully" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to record health check report" }, { status: 500 });
  }
}
