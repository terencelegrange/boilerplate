"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PasskeyConfig {
  enabled: boolean;
  rpName: string;
  rpID: string;
  stats?: {
    totalCredentials: number;
    totalUsersWithPasskeys: number;
  };
}

export default function AdminPasskeysSettingsPage() {
  const [config, setConfig] = useState<PasskeyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/passkeys/config");
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
      }
    } catch {
      setMsg({ type: "error", text: "Failed to load passkeys configuration" });
    } finally {
      setLoading(false);
    }
  }

  async function togglePasskeys(newValue: boolean) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/passkeys/config", {
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
            ? "Passkeys enabled system-wide. Users can now register passkeys in their Personal Security center."
            : "Passkeys disabled system-wide.",
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
          <span className="text-gray-900 dark:text-white font-medium">Passkeys</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Passkeys & WebAuthn</h1>
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
          Configure FIDO2 / WebAuthn biometric passkeys and physical security key authentication for all platform users.
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
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Enable Passkeys System-Wide</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                Passkeys replace traditional passwords with cryptographic public-private key pairs stored securely in device hardware (Apple Secure Enclave, Android Keystore, Windows Hello) or physical YubiKeys.
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
              onClick={() => config && togglePasskeys(!config.enabled)}
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
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Total Registered Keys</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {config?.stats?.totalCredentials ?? 0}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Biometric & hardware tokens</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Enrolled Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {config?.stats?.totalUsersWithPasskeys ?? 0}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Active passkey users</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Relying Party ID (Domain)</p>
            <p className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-2 truncate">
              {config?.rpID || "Resolving…"}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{config?.rpName || "Boilerplate App"}</p>
          </div>
        </div>

        {/* Supported Authenticator Ecosystems */}
        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
            Supported Authenticator Types
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Software & Platform Biometrics</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Apple Touch ID, Face ID, Windows Hello, Android Fingerprint/Face Unlock, and synced keychains (iCloud, Google Password Manager, 1Password, Bitwarden).
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Hardware Security Tokens</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  External physical security keys including Yubico YubiKeys, Feitian, SoloKeys, and Nitrokeys via USB-A, USB-C, NFC, and Lightning.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* User Configuration Flow Note */}
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-gray-900 dark:text-white">How Users Enroll</p>
            <p>
              When enabled, each user can navigate to their avatar menu &rarr; <span className="font-semibold text-emerald-600 dark:text-emerald-400">Security</span> to add their personal passkeys. Additionally, a <span className="font-semibold text-emerald-600 dark:text-emerald-400">&ldquo;Sign in with Passkey&rdquo;</span> option will appear on the sign-in screen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
