import { NextRequest, NextResponse } from "next/server";
import { COOKIE, REMEMBERED_COOKIE, getSession, parseRemembered } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) {
    await auditLog({ userId: parseInt(session.sub), action: "LOGOUT", resource: "sessions", ip: getIp(req) });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });

  if (session) {
    const userId = parseInt(session.sub, 10);
    const remaining = parseRemembered(req.cookies.get(REMEMBERED_COOKIE)?.value).filter((p) => p.id !== userId);
    if (remaining.length > 0) {
      res.cookies.set(REMEMBERED_COOKIE, JSON.stringify(remaining), { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    } else {
      res.cookies.set(REMEMBERED_COOKIE, "", { maxAge: 0, path: "/" });
    }
  }

  return res;
}
