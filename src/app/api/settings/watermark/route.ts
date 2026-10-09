import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getWatermarkConfig, generateWatermarkOverlayPayload } from "@/lib/watermark";

export async function GET() {
  await initDb();
  const session = await getSession();
  const config = await getWatermarkConfig();

  let overlay: any = { enabled: false, text: "", qrDataUrl: null, opacity: 7, fontSize: 12 };

  if (session && session.sub !== "apikey" && config.enabled) {
    const userId = Number(session.sub);
    overlay = await generateWatermarkOverlayPayload({
      id: userId,
      email: session.email,
      name: session.name,
    });
  }

  return NextResponse.json({
    config,
    overlay,
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
  const customText = body.customText?.trim() || "{{email}} • CONFIDENTIAL";
  const showQr = body.showQr ? 1 : 0;
  const opacity = Math.max(1, Math.min(100, Number(body.opacity) || 7));
  const fontSize = Math.max(8, Math.min(36, Number(body.fontSize) || 12));

  // Update feature flag
  await prisma.$executeRaw`
    INSERT INTO feature_flags (\`key\`, enabled, label, description)
    VALUES ('watermarking', ${enabled}, 'Forensic Watermarking', 'Display subtle 45-degree tiled watermark and user QR verification overlay')
    ON DUPLICATE KEY UPDATE enabled = ${enabled}
  `;

  // Update watermark config
  await prisma.$executeRaw`
    INSERT INTO watermark_config (id, enabled, custom_text, show_qr, opacity, font_size, updated_at)
    VALUES (1, ${enabled}, ${customText}, ${showQr}, ${opacity}, ${fontSize}, NOW())
    ON DUPLICATE KEY UPDATE
      enabled = ${enabled},
      custom_text = ${customText},
      show_qr = ${showQr},
      opacity = ${opacity},
      font_size = ${fontSize},
      updated_at = NOW()
  `;

  await auditLog({
    userId: session.sub === "apikey" ? undefined : Number(session.sub),
    action: enabled ? "WATERMARK_ENABLED" : "WATERMARK_DISABLED",
    resource: "watermark_config",
    details: { enabled: !!enabled, customText, showQr: !!showQr, opacity, fontSize },
    ip: getIp(req),
  });

  return NextResponse.json({
    ok: true,
    config: {
      enabled: !!enabled,
      customText,
      showQr: !!showQr,
      opacity,
      fontSize,
    },
  });
}
