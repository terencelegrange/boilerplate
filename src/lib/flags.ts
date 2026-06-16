import { prisma } from "./prisma";

export async function isFlagEnabled(key: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ enabled: number }[]>`
      SELECT enabled FROM feature_flags WHERE \`key\` = ${key} LIMIT 1
    `;
    if (rows.length === 0) return true; // default to enabled if unknown
    return rows[0].enabled === 1;
  } catch {
    return true; // fail open
  }
}
