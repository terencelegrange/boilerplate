import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";

async function checkSite(site: { id: number; health_check_url: string }) {
  const start = Date.now();
  let status = "down";
  let statusCode: number | null = null;
  let latency: number | null = null;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(site.health_check_url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "User-Agent": "Omni-Health-Agent/1.0"
      },
      signal: AbortSignal.timeout(5000) // 5s timeout
    });

    latency = Date.now() - start;
    statusCode = res.status;

    if (res.status >= 200 && res.status < 400) {
      status = "up";
    } else {
      errorMsg = `HTTP Error Status: ${res.status}`;
    }
  } catch (err: any) {
    latency = Date.now() - start;
    errorMsg = err.name === "TimeoutError" ? "Timeout (5000ms)" : (err.message || String(err));
  }

  // Write log to DB
  await prisma.$executeRaw`
    INSERT INTO health_check_logs (site_id, status, status_code, latency, error, created_at)
    VALUES (${site.id}, ${status}, ${statusCode}, ${latency}, ${errorMsg}, NOW())
  `;

  // Update site status and last_checked
  await prisma.$executeRaw`
    UPDATE sites
    SET status = ${status},
        last_checked = NOW()
    WHERE id = ${site.id}
  `;

  return { siteId: site.id, status, statusCode, latency, error: errorMsg };
}

export async function POST(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { siteId } = body;
    const { searchParams } = new URL(req.url);
    const env = searchParams.get("env") || body.env;

    let sites: any[] = [];

    if (siteId) {
      // Check single site
      sites = await prisma.$queryRaw<any[]>`
        SELECT id, health_check_url FROM sites WHERE id = ${Number(siteId)} LIMIT 1
      `;
      if (sites.length === 0) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }
    } else if (env) {
      // Check all sites in the environment
      sites = await prisma.$queryRaw<any[]>`
        SELECT id, health_check_url FROM sites WHERE environment = ${env}
      `;
    } else {
      return NextResponse.json({ error: "Missing siteId or env parameter" }, { status: 400 });
    }

    if (sites.length === 0) {
      return NextResponse.json({ message: "No sites to check", results: [] });
    }

    // Run checks in parallel
    const results = await Promise.all(sites.map((site) => checkSite(site)));

    return NextResponse.json({ message: `Successfully ran ${results.length} health checks`, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to execute health checks" }, { status: 500 });
  }
}
