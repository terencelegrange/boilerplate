import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  await initDb();

  const enabled = await isPasskeysEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Passkeys are currently disabled system-wide" }, { status: 403 });
  }

  const { rpID } = getRPConfig(req);

  // Optional: check if an email was passed in body to restrict allowed credentials if desired
  let allowCredentials: any[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (body.email) {
      const userRows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE email = ${body.email} LIMIT 1
      `;
      if (userRows.length > 0) {
        const credentials = await prisma.$queryRaw<{ id: string; transports: string | null }[]>`
          SELECT id, transports FROM passkey_credentials WHERE user_id = ${userRows[0].id}
        `;
        allowCredentials = credentials.map((c) => ({
          id: c.id,
          transports: c.transports ? JSON.parse(c.transports) : undefined,
        }));
      }
    }
  } catch {}

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    timeout: 60000,
  });

  const challengeId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store authentication challenge
  await prisma.$executeRaw`
    INSERT INTO passkey_challenges (id, challenge, user_id, expires_at, created_at)
    VALUES (${challengeId}, ${options.challenge}, NULL, ${expiresAt}, NOW())
  `;

  return NextResponse.json({ options, challengeId });
}
