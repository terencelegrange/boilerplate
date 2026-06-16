import { NextRequest, NextResponse } from "next/server";
import { COOKIE, getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) {
    await auditLog({ userId: parseInt(session.sub), action: "LOGOUT", resource: "sessions", ip: getIp(req) });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
