import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";

export async function GET(req: NextRequest) {
  await initDb();
  const enabled = await isPasskeysEnabled();
  const { rpName, rpID } = getRPConfig(req);

  // Also query count of credentials and registered users for admin telemetry
  const counts = await prisma.$queryRaw<{ totalCredentials: bigint; totalUsers: bigint }[]>`
    SELECT 
      COUNT(*) AS totalCredentials,
      COUNT(DISTINCT user_id) AS totalUsers
    FROM passkey_credentials
  `.catch(() => [{ totalCredentials: BigInt(0), totalUsers: BigInt(0) }]);

  return NextResponse.json({
    enabled,
    rpName,
    rpID,
    stats: {
      totalCredentials: Number(counts[0]?.totalCredentials ?? 0),
      totalUsersWithPasskeys: Number(counts[0]?.totalUsers ?? 0),
    },
  });
}

export async function PATCH(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const enabled = body.enabled ? 1 : 0;

  await prisma.$executeRaw`
    INSERT INTO feature_flags (\`key\`, enabled, label, description)
    VALUES ('passkeys', ${enabled}, 'Passkeys (FIDO2/WebAuthn)', 'Allow users to register and sign in with biometric passkeys and security keys')
    ON DUPLICATE KEY UPDATE enabled = ${enabled}
  `;

  await auditLog({
    userId: session.sub === "apikey" ? undefined : Number(session.sub),
    action: enabled ? "PASSKEYS_ENABLED" : "PASSKEYS_DISABLED",
    resource: "security_config",
    details: { enabled: !!enabled },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, enabled: !!enabled });
}
