"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WatermarkConfig {
  enabled: boolean;
  customText: string;
  showQr: boolean;
  opacity: number;
}

export default function AdminWatermarkingSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [customText, setCustomText] = useState("{{email}} • CONFIDENTIAL");
  const [showQr, setShowQr] = useState(true);
  const [opacity, setOpacity] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/watermark");
      const data = await res.json();
      if (res.ok && data.config) {
        setEnabled(!!data.config.enabled);
        setCustomText(data.config.customText || "{{email}} • CONFIDENTIAL");
        setShowQr(data.config.showQr !== false);
        setOpacity(data.config.opacity || 7);
      }
    } catch {
      setMsg({ type: "error", text: "Failed to load watermarking configuration" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/watermark", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          customText,
          showQr,
          opacity,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({
          type: "success",
          text: enabled
            ? "Forensic watermarking active across all dashboard pages."
            : "Forensic watermarking disabled.",
        });
      } else {
        setMsg({ type: "error", text: data.error || "Failed to save configuration" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error saving configuration" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Link href="/settings" className="hover:text-emerald-500 transition">Settings</Link>
          <span>/</span>
          <Link href="/settings/security" className="hover:text-emerald-500 transition">Security</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Forensic Watermarking</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forensic Screen Watermarking</h1>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              enabled
                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                : "bg-gray-500/10 text-gray-600 dark:text-slate-400 border-gray-500/20"
            }`}
          >
            {enabled ? "Overlay Active" : "Disabled"}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Display a non-blocking diagonal 45-degree tiled watermark and scannable QR code across all pages to trace leaked screenshots.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            msg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-xs opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {/* Main Admin Control Card */}
      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Enable Screen Watermarking</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                When active, every screen renders a subtle, repeating watermark with the logged-in user&apos;s identity and an embedded QR code. If anyone captures a screenshot or takes a phone photo, the leak can be traced immediately.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              {enabled ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-700"
              } ${loading || saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Watermark Configuration Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Watermark Text Template
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="{{email}} • CONFIDENTIAL • {{date}}"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-cyan-500 font-mono transition"
                required
              />
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                Supported tags: <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">{"{{email}}"}</code>, <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">{"{{name}}"}</code>, <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">{"{{id}}"}</code>, <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">{"{{date}}"}</code>
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">Include QR Code</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Renders a small scannable QR code beside the watermark text pointing to the user session.
                </p>
              </div>
              <input
                type="checkbox"
                checked={showQr}
                onChange={(e) => setShowQr(e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded border-gray-300 dark:border-slate-600 focus:ring-cyan-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Overlay Opacity ({opacity}%)
                </label>
                <span className="text-[11px] text-gray-400">Subtle & non-intrusive</span>
              </div>
              <input
                type="range"
                min="2"
                max="25"
                step="1"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>Faint (2%)</span>
                <span>Medium (10%)</span>
                <span>Prominent (25%)</span>
              </div>
            </div>
          </div>

          {/* Live Interactive Preview Box */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Live Appearance Preview</span>
            <div className="relative h-56 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/60 overflow-hidden flex items-center justify-center p-4 select-none">
              {/* Fake UI Content */}
              <div className="w-full space-y-2.5 opacity-60">
                <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded w-full" />
                <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded w-5/6" />
                <div className="h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-lg w-1/2 flex items-center px-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Sample Dashboard Data Card
                </div>
              </div>

              {/* Watermark Overlay in Preview */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ opacity: opacity / 100 }}
              >
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern
                      id="preview-watermark-pattern"
                      width="260"
                      height="150"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(-35)"
                    >
                      {showQr && (
                        <rect x="10" y="55" width="22" height="22" rx="2" fill="currentColor" opacity="0.8" />
                      )}
                      <text
                        x={showQr ? "40" : "15"}
                        y="72"
                        fill="currentColor"
                        className="text-gray-900 dark:text-white font-mono font-bold text-[10px] tracking-wider"
                      >
                        {customText.replace(/\{\{email\}\}/gi, "admin@example.com").replace(/\{\{date\}\}/gi, "2026-10-09")}
                      </text>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#preview-watermark-pattern)" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold text-xs rounded-xl shadow-sm transition"
          >
            {saving ? "Saving Changes…" : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
