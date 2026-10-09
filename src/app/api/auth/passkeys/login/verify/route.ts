import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE, THEME_COOKIE } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getRPConfig, isPasskeysEnabled } from "@/lib/passkeys";

interface UserRow {
  id: number;
  email: string;
  role: string;
  status: string;
  theme: string;
  name: string | null;
  avatar: number | null;
}

export async function POST(req: NextRequest) {
  await initDb();

  const enabled = await isPasskeysEnabled();
  if (!enabled) {
    return NextResponse.json({ error: "Passkeys are currently disabled system-wide" }, { status: 403 });
  }

  const body = await req.json();
  const { response, challengeId } = body;

  if (!response || !challengeId || !response.id) {
    return NextResponse.json({ error: "Invalid authentication payload" }, { status: 400 });
  }

  // Retrieve challenge
  const challengeRows = await prisma.$queryRaw<{ id: string; challenge: string; expires_at: Date }[]>`
    SELECT id, challenge, expires_at FROM passkey_challenges
    WHERE id = ${challengeId} AND expires_at > NOW()
    LIMIT 1
  `;

  if (challengeRows.length === 0) {
    return NextResponse.json({ error: "Authentication session expired. Please try again." }, { status: 400 });
  }

  const challenge = challengeRows[0];

  // Clean up challenge
  await prisma.$executeRaw`
    DELETE FROM passkey_challenges WHERE id = ${challengeId}
  `.catch(() => {});

  // Fetch credential
  const credentialRows = await prisma.$queryRaw<{
    id: string;
    user_id: number;
    public_key: string;
    counter: bigint;
    transports: string | null;
    name: string;
  }[]>`
    SELECT id, user_id, public_key, counter, transports, name
    FROM passkey_credentials
    WHERE id = ${response.id}
    LIMIT 1
  `;

  if (credentialRows.length === 0) {
    return NextResponse.json({ error: "Passkey is not registered with any account" }, { status: 404 });
  }

  const credential = credentialRows[0];

  // Fetch associated user
  const userRows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, role, status, theme, name, avatar
    FROM users
    WHERE id = ${credential.user_id}
    LIMIT 1
  `;

  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "Associated user account not found" }, { status: 404 });
  }

  if (user.status === "pending") {
    return NextResponse.json({ error: "Your account is awaiting approval" }, { status: 403 });
  }
  if (user.status === "rejected") {
    return NextResponse.json({ error: "Your account has been rejected" }, { status: 403 });
  }

  const { rpID, origin } = getRPConfig(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(credential.public_key, "base64"),
        counter: Number(credential.counter),
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      },
      requireUserVerification: false,
    });
  } catch (err: any) {
    console.error("[Passkey verifyAuthenticationResponse] error:", err);
    await auditLog({
      userId: user.id,
      action: "LOGIN_PASSKEY_FAILED",
      resource: "sessions",
      details: { error: err.message, credentialId: credential.id },
      ip: getIp(req),
    });
    return NextResponse.json({ error: err.message || "Passkey verification failed" }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Passkey authentication failed" }, { status: 401 });
  }

  // Update credential counter and last_used
  const newCounter = BigInt(verification.authenticationInfo.newCounter);
  await prisma.$executeRaw`
    UPDATE passkey_credentials
    SET counter = ${newCounter}, last_used = NOW()
    WHERE id = ${credential.id}
  `;

  // Update user's last login
  await prisma.$executeRaw`
    UPDATE users SET updated_at = NOW() WHERE id = ${user.id}
  `.catch(() => {});

  const token = await signToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  await auditLog({
    userId: user.id,
    action: "LOGIN_PASSKEY",
    resource: "sessions",
    details: { credentialName: credential.name, credentialId: credential.id },
    ip: getIp(req),
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    },
  });

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set(THEME_COOKIE, user.theme || "dark", {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
