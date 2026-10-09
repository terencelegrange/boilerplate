"use client";

import { useEffect, useState } from "react";

interface WatermarkData {
  enabled: boolean;
  text: string;
  qrDataUrl: string | null;
  opacity: number;
  fontSize?: number;
}

export default function WatermarkOverlay() {
  const [data, setData] = useState<WatermarkData | null>(null);

  useEffect(() => {
    fetch("/api/settings/watermark")
      .then((r) => r.json())
      .then((res) => {
        if (res.overlay && res.overlay.enabled) {
          setData(res.overlay);
        } else {
          setData(null);
        }
      })
      .catch(() => {});
  }, []);

  if (!data || !data.enabled || !data.text) return null;

  const opacityStyle = { opacity: Math.max(0.02, Math.min(0.3, data.opacity / 100)) };
  const fontSize = data.fontSize || 12;
  const patternWidth = Math.max(380, 280 + fontSize * 10);
  const patternHeight = Math.max(220, 180 + fontSize * 4);
  const qrSize = Math.max(32, Math.min(48, fontSize * 2.8));

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[99999] select-none overflow-hidden"
      style={opacityStyle}
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="watermark-pattern"
            width={patternWidth}
            height={patternHeight}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-35)"
          >
            {data.qrDataUrl && (
              <image
                href={data.qrDataUrl}
                x="20"
                y={patternHeight / 2 - qrSize / 2}
                width={qrSize}
                height={qrSize}
                opacity="0.9"
              />
            )}
            <text
              x={data.qrDataUrl ? 28 + qrSize : 24}
              y={patternHeight / 2 + fontSize * 0.35}
              fill="currentColor"
              style={{ fontSize: `${fontSize}px` }}
              className="text-gray-900 dark:text-white font-mono font-bold tracking-wider"
            >
              {data.text}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
      </svg>
    </div>
  );
}
