"use client";

import Link from "next/link";

const SECURITY_TILES = [
  {
    key: "mfa",
    label: "Multi-Factor Authentication (MFA)",
    badge: "Coming Soon",
    description: "Time-based One-Time Password (TOTP) authenticator app verification and emergency recovery codes.",
    icon: (
      <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    bgClass: "bg-indigo-500/10 border-indigo-500/20",
    href: "/settings/security/mfa",
    highlight: "TOTP 2FA & Backup Codes",
  },
  {
    key: "passkeys",
    label: "Passkeys (FIDO2 / WebAuthn)",
    badge: "Coming Soon",
    description: "Biometric passwordless authentication using Face ID, Touch ID, Windows Hello, and hardware YubiKeys.",
    icon: (
      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
    href: "/settings/security/passkeys",
    highlight: "Biometric & Hardware Keys",
  },
  {
    key: "watermarking",
    label: "Forensic Watermarking",
    badge: "Coming Soon",
    description: "Dynamic on-screen session overlays and steganographic data export tagging to trace unauthorized data leaks.",
    icon: (
      <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    bgClass: "bg-cyan-500/10 border-cyan-500/20",
    href: "/settings/security/watermarking",
    highlight: "Dynamic Session & Export Tags",
  },
];

export default function SecuritySettingsHubPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Link href="/settings" className="hover:text-emerald-500 transition">Settings</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Security</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security & Access Control</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Platform Shield
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Manage advanced identity verification, hardware passkeys, session protection, and data governance policies.
        </p>
      </div>

      {/* Security Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SECURITY_TILES.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-105 transition ${tile.bgClass}`}>
                  {tile.icon}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {tile.badge}
                </span>
              </div>

              <div className="mt-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-emerald-500 transition">
                  {tile.label}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {tile.description}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-400">
                {tile.highlight}
              </span>
              <span className="text-emerald-500 font-semibold group-hover:translate-x-0.5 transition inline-flex items-center gap-1">
                View &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Security Policy Information Card */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div className="text-xs text-gray-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-gray-900 dark:text-white">Enterprise Security Architecture</p>
          <p>
            These security modules are designed to integrate directly with the existing RBAC system and session authorization middleware. Once released, admins will be able to enforce mandatory MFA or Passkey enrollment on a per-role basis.
          </p>
        </div>
      </div>
    </div>
  );
}
