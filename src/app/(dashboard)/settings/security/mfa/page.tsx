"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MfaConfig {
  enabled: boolean;
  stats?: {
    totalEnrolledUsers: number;
  };
}

export default function AdminMfaSettingsPage() {
  const [config, setConfig] = useState<MfaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/config");
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
      }
    } catch {
      setMsg({ type: "error", text: "Failed to load MFA configuration" });
    } finally {
      setLoading(false);
    }
  }

  async function toggleMfa(newValue: boolean) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/mfa/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig((prev) => (prev ? { ...prev, enabled: data.enabled } : null));
        setMsg({
          type: "success",
          text: data.enabled
            ? "Multi-Factor Authentication enabled system-wide. Users can now enroll their authenticator apps."
            : "Multi-Factor Authentication disabled system-wide.",
        });
      } else {
        setMsg({ type: "error", text: data.error || "Failed to update configuration" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error updating configuration" });
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
          <span className="text-gray-900 dark:text-white font-medium">Multi-Factor Authentication</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Multi-Factor Authentication (MFA)</h1>
          {config && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                config.enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-gray-500/10 text-gray-600 dark:text-slate-400 border-gray-500/20"
              }`}
            >
              {config.enabled ? "Active System-Wide" : "Disabled System-Wide"}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Enforce two-step verification using Time-Based One-Time Password (TOTP) authenticator apps.
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
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Enable MFA System-Wide</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                Multi-Factor Authentication (MFA) adds a second layer of defense by requiring a dynamic 6-digit code from an authenticator app (such as Google Authenticator, Microsoft Authenticator, or 1Password) during login.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              {config?.enabled ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => config && toggleMfa(!config.enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config?.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-700"
              } ${loading || saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config?.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Telemetry Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Total Enrolled Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {config?.stats?.totalEnrolledUsers ?? 0}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Active TOTP accounts</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Standard Algorithm</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-2">
              RFC 6238 TOTP (SHA-1)
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">30-second time steps</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Emergency Recovery</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-2">
              8 Single-Use Codes
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">SHA-256 hashed storage</p>
          </div>
        </div>

        {/* Supported Authenticator Ecosystems */}
        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
            Compatible Authenticator Applications
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <p className="text-xs font-bold text-gray-900 dark:text-white">Google Authenticator</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">iOS & Android</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <p className="text-xs font-bold text-gray-900 dark:text-white">Microsoft Authenticator</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Enterprise Cloud Sync</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <p className="text-xs font-bold text-gray-900 dark:text-white">1Password & Apple Keychain</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Cross-device auto-fill</p>
            </div>
          </div>
        </div>

        {/* User Configuration Flow Note */}
        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-gray-900 dark:text-white">User Enrollment Flow</p>
            <p>
              When enabled, users can navigate to their avatar menu &rarr; <span className="font-semibold text-indigo-600 dark:text-indigo-400">Security</span> to scan their QR code and activate 2FA. Once configured, their subsequent email & password logins will prompt for a 6-digit confirmation code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
