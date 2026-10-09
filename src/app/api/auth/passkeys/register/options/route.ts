import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  await initDb();

  const enabled = await isPasskeysEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Passkeys are currently disabled system-wide" }, { status: 403 });
  }

  const session = await getSession();
  if (!session || session.sub === "apikey") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.sub);
  const userRows = await prisma.$queryRaw<{ id: number; email: string; name: string | null }[]>`
    SELECT id, email, name FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch user's existing credentials to exclude
  const existingCredentials = await prisma.$queryRaw<{ id: string; transports: string | null }[]>`
    SELECT id, transports FROM passkey_credentials WHERE user_id = ${userId}
  `;

  const excludeCredentials = existingCredentials.map((c) => ({
    id: c.id,
    transports: c.transports ? (JSON.parse(c.transports) as any) : undefined,
  }));

  const { rpID, rpName } = getRPConfig(req);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(String(user.id)),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    timeout: 60000,
  });

  const challengeId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Clean up any stale challenges for this user first
  await prisma.$executeRaw`
    DELETE FROM passkey_challenges WHERE user_id = ${userId} OR expires_at < NOW()
  `.catch(() => {});

  // Store new challenge
  await prisma.$executeRaw`
    INSERT INTO passkey_challenges (id, challenge, user_id, expires_at, created_at)
    VALUES (${challengeId}, ${options.challenge}, ${userId}, ${expiresAt}, NOW())
  `;

  return NextResponse.json({ options, challengeId });
}
