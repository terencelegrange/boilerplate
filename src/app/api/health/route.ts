import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EXPECTED_TABLES } from "@/lib/initDb";

interface CheckResult {
  status: "ok" | "error";
  [key: string]: unknown;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function checkTables(): Promise<CheckResult> {
  try {
    const placeholders = EXPECTED_TABLES.map((t) => `'${t}'`).join(", ");
    const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`
    );
    const present = new Set(rows.map((r) => r.TABLE_NAME));
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
    return missing.length === 0
      ? { status: "ok", checked: EXPECTED_TABLES.length }
      : { status: "error", missing };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function GET() {
  const database = await checkDatabase();
  const tables = database.status === "ok"
    ? await checkTables()
    : { status: "error" as const, error: "skipped - database check failed" };

  const allOk = database.status === "ok" && tables.status === "ok";

  return NextResponse.json(
    {
      status: allOk ? "ok" : "error",
      timestamp: new Date().toISOString(),
      checks: {
        server: { status: "ok" },
        database,
        tables,
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
