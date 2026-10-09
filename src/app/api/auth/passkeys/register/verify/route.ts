import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";

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
  const body = await req.json();
  const { response, challengeId, name } = body;

  if (!response || !challengeId) {
    return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
  }

  // Retrieve challenge
  const challengeRows = await prisma.$queryRaw<{ id: string; challenge: string; expires_at: Date }[]>`
    SELECT id, challenge, expires_at FROM passkey_challenges
    WHERE id = ${challengeId} AND user_id = ${userId} AND expires_at > NOW()
    LIMIT 1
  `;

  if (challengeRows.length === 0) {
    return NextResponse.json({ error: "Registration challenge expired or invalid. Please try again." }, { status: 400 });
  }

  const challenge = challengeRows[0];

  // Clean up used challenge
  await prisma.$executeRaw`
    DELETE FROM passkey_challenges WHERE id = ${challengeId}
  `.catch(() => {});

  const { rpID, origin } = getRPConfig(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err: any) {
    console.error("[Passkey verifyRegistrationResponse] error:", err);
    return NextResponse.json({ error: err.message || "Passkey verification failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Failed to verify passkey registration" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const credentialId = credential.id;
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString("base64");
  const counter = BigInt(credential.counter);
  const transports = credential.transports ? JSON.stringify(credential.transports) : null;
  const passkeyName = (name && name.trim()) ? name.trim() : (credentialDeviceType === "singleDevice" ? "Security Key" : "Biometric Passkey");

  // Save credential
  await prisma.$executeRaw`
    INSERT INTO passkey_credentials (
      id, user_id, public_key, counter, device_type, backed_up, transports, name, created_at, last_used
    ) VALUES (
      ${credentialId},
      ${userId},
      ${publicKeyBase64},
      ${counter},
      ${credentialDeviceType},
      ${credentialBackedUp ? 1 : 0},
      ${transports},
      ${passkeyName},
      NOW(),
      NOW()
    ) ON DUPLICATE KEY UPDATE
      public_key = ${publicKeyBase64},
      counter = ${counter},
      device_type = ${credentialDeviceType},
      backed_up = ${credentialBackedUp ? 1 : 0},
      transports = ${transports},
      name = ${passkeyName},
      last_used = NOW()
  `;

  await auditLog({
    userId,
    action: "PASSKEY_REGISTERED",
    resource: "passkey_credentials",
    details: { passkeyName, deviceType: credentialDeviceType, credentialId },
    ip: getIp(req),
  });

  return NextResponse.json({
    ok: true,
    credential: {
      id: credentialId,
      name: passkeyName,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
  });
}
