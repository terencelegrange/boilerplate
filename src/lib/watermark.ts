import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export interface WatermarkConfig {
  enabled: boolean;
  customText: string;
  showQr: boolean;
  opacity: number;
}

export async function getWatermarkConfig(): Promise<WatermarkConfig> {
  try {
    const flagRows = await prisma.$queryRaw<{ enabled: number }[]>`
      SELECT enabled FROM feature_flags WHERE \`key\` = 'watermarking' LIMIT 1
    `;
    const flagEnabled = flagRows.length > 0 ? flagRows[0].enabled === 1 : false;

    const rows = await prisma.$queryRaw<{
      enabled: number;
      custom_text: string;
      show_qr: number;
      opacity: number;
    }[]>`
      SELECT enabled, custom_text, show_qr, opacity FROM watermark_config WHERE id = 1 LIMIT 1
    `;

    if (rows.length === 0) {
      return {
        enabled: false,
        customText: "{{email}} • CONFIDENTIAL",
        showQr: true,
        opacity: 7,
      };
    }

    const row = rows[0];
    return {
      enabled: flagEnabled && row.enabled === 1,
      customText: row.custom_text || "{{email}} • CONFIDENTIAL",
      showQr: row.show_qr === 1,
      opacity: Math.max(1, Math.min(100, row.opacity || 7)),
    };
  } catch (e) {
    console.error("[getWatermarkConfig] error:", e);
    return {
      enabled: false,
      customText: "{{email}} • CONFIDENTIAL",
      showQr: true,
      opacity: 7,
    };
  }
}

export async function generateWatermarkOverlayPayload(user: {
  id: number;
  email: string;
  name?: string | null;
}) {
  const config = await getWatermarkConfig();
  if (!config.enabled) {
    return { enabled: false, text: "", qrDataUrl: null, opacity: 7 };
  }

  const today = new Date().toISOString().slice(0, 10);
  const text = config.customText
    .replace(/\{\{email\}\}/gi, user.email)
    .replace(/\{\{name\}\}/gi, user.name || user.email.split("@")[0])
    .replace(/\{\{id\}\}/gi, String(user.id))
    .replace(/\{\{date\}\}/gi, today);

  let qrDataUrl: string | null = null;
  if (config.showQr) {
    const qrPayload = JSON.stringify({
      u: user.id,
      e: user.email,
      t: Date.now(),
      app: "Boilerplate",
    });

    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 0,
      width: 48,
      errorCorrectionLevel: "L",
      color: {
        dark: "#000000",
        light: "#00000000", // Transparent background
      },
    });
  }

  return {
    enabled: true,
    text,
    qrDataUrl,
    opacity: config.opacity,
  };
}
