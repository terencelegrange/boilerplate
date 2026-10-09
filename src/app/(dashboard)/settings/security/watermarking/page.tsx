"use client";

import Link from "next/link";

export default function WatermarkingSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Link href="/settings" className="hover:text-emerald-500 transition">Settings</Link>
          <span>/</span>
          <Link href="/settings/security" className="hover:text-emerald-500 transition">Security</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Watermarking</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forensic Watermarking</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Dynamic visual session stamps and hidden digital metadata to deter and trace unauthorized data exfiltration.
        </p>
      </div>

      {/* Main Preview Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Leak Prevention & Traceability</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
              Forensic watermarking overlays user identity, timestamp, and IP address faintly across sensitive dashboards and embeds invisible forensic signatures into CSV/PDF exports to trace information leaks back to the source.
            </p>
          </div>
        </div>

        {/* Capabilities Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white">Dynamic Session Overlay</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              Renders user email, company ID, and current timestamp diagonally across protected views.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white">Export Steganography</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              Embeds cryptographically signed zero-width metadata into exported spreadsheets and PDF reports.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white">Tamper Detection</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              Client-side DOM mutation observers prevent watermark removal via browser inspection tools.
            </p>
          </div>
        </div>

        {/* Mock UI Preview */}
        <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-xl p-5 bg-gray-50/50 dark:bg-slate-950/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Watermarking Policy</span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
              Preview Mode
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full w-4/5 animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full w-2/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
