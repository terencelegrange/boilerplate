import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
}

export async function GET() {
  await initDb();
  const rows = await prisma.$queryRaw<{ key: string; enabled: number; label: string; description: string }[]>`
    SELECT \`key\`, enabled, label, description FROM feature_flags ORDER BY \`key\`
  `;
  const flags: Record<string, FeatureFlag> = {};
  for (const r of rows) {
    flags[r.key] = { key: r.key, enabled: r.enabled === 1, label: r.label, description: r.description };
  }
  return NextResponse.json(flags);
}
