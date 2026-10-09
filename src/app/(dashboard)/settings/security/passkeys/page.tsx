"use client";

import Link from "next/link";

export default function PasskeysSettingsPage() {
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
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          FIDO2 passwordless authentication with biometrics and hardware security tokens.
        </p>
      </div>

      {/* Main Preview Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">FIDO2 / WebAuthn Biometrics</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
              Passkeys replace traditional passwords with cryptographic public-private key pairs stored securely in device hardware (Apple Secure Enclave, Android Keystore, Windows Hello) or physical YubiKeys.
            </p>
          </div>
        </div>

        {/* Capabilities Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white">Phishing Resistant</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              Bound directly to the application domain, eliminating credential stuffing and phishing attacks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white">Multi-Device Sync</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              Seamlessly synchronizes via iCloud Keychain, Google Password Manager, and 1Password.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800">
            <p className="text-xs font-bold text-gray-900 dark:text-white">Hardware Keys</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              Supports external USB-C, NFC, and Lightning security keys (Yubico, Feitian, SoloKeys).
            </p>
          </div>
        </div>

        {/* Mock UI Preview */}
        <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-xl p-5 bg-gray-50/50 dark:bg-slate-950/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Registered Security Keys</span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase">
              Preview Mode
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full w-3/4 animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full w-1/3 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
