import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";

export async function GET(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const env = searchParams.get("env") || "dev";

  try {
    // 1. Get all sites in the environment
    const sites = await prisma.$queryRaw<any[]>`
      SELECT id, name, url, health_check_url, environment, status, last_checked, created_at, updated_at
      FROM sites
      WHERE environment = ${env}
      ORDER BY name ASC
    `;

    // 2. Fetch the last 5 logs for each site
    const sitesWithLogs = await Promise.all(
      sites.map(async (site) => {
        const logs = await prisma.$queryRaw<any[]>`
          SELECT id, status, status_code, latency, error, created_at
          FROM health_check_logs
          WHERE site_id = ${site.id}
          ORDER BY created_at DESC
          LIMIT 5
        `;
        return {
          ...site,
          // Reverse logs to show chronological order left-to-right (oldest to newest of the last 5)
          recentLogs: logs.reverse()
        };
      })
    );

    return NextResponse.json(sitesWithLogs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch health checks" }, { status: 500 });
  }
}
