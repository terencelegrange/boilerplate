"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { startRegistration } from "@simplewebauthn/browser";

interface CredentialItem {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsed: string | null;
}

interface MfaStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  createdAt: string | null;
}

interface AuditLogItem {
  id: number;
  action: string;
  method: string;
  browser?: string;
  os?: string;
  ip: string;
  createdAt: string;
}

export default function PersonalSecurityPage() {
  const [passkeysEnabled, setPasskeysEnabled] = useState<boolean | null>(null);
  const [mfaSystemEnabled, setMfaSystemEnabled] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Passkey Modal State
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [showAddPasskeyModal, setShowAddPasskeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // MFA Setup State
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [backupCodesReceived, setBackupCodesReceived] = useState<string[] | null>(null);

  // MFA Disable State
  const [showMfaDisableModal, setShowMfaDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disablingMfa, setDisablingMfa] = useState(false);

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [passkeyCfg, mfaCfg, credRes, mfaStatRes, auditRes] = await Promise.all([
        fetch("/api/auth/passkeys/config"),
        fetch("/api/auth/mfa/config"),
        fetch("/api/auth/passkeys/credentials"),
        fetch("/api/auth/mfa/status"),
        fetch("/api/me/audit"),
      ]);

      const pData = await passkeyCfg.json();
      setPasskeysEnabled(!!pData.enabled);

      const mData = await mfaCfg.json();
      setMfaSystemEnabled(!!mData.enabled);

      if (credRes.ok) {
        const credData = await credRes.json();
        setCredentials(credData.credentials || []);
      }

      if (mfaStatRes.ok) {
        const mStatus = await mfaStatRes.json();
        setMfaStatus(mStatus);
      }

      if (auditRes.ok) {
        const aData = await auditRes.json();
        setAuditLogs(aData.logs || []);
      }
    } catch {
      setMsg({ type: "error", text: "Failed to load security settings" });
    } finally {
      setLoading(false);
    }
  }

  // --- Passkeys Actions ---
  async function handleRegisterPasskey(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setRegisteringPasskey(true);

    try {
      const optRes = await fetch("/api/auth/passkeys/register/options", { method: "POST" });
      const optData = await optRes.json();
      if (!optRes.ok) throw new Error(optData.error || "Failed to initialize passkey registration");

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optData.options });
      } catch (err: any) {
        if (err.name === "NotAllowedError" || err.message?.includes("timed out") || err.message?.includes("cancelled")) {
          throw new Error("Passkey registration cancelled or timed out.");
        }
        throw new Error(err.message || "Failed to complete passkey prompt.");
      }

      const verifyRes = await fetch("/api/auth/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: attResp,
          challengeId: optData.challengeId,
          name: keyName.trim() || undefined,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Server verification failed");

      setMsg({ type: "success", text: "Passkey registered successfully! You can now use it to sign in." });
      setShowAddPasskeyModal(false);
      setKeyName("");
      loadAllData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Passkey registration failed" });
    } finally {
      setRegisteringPasskey(false);
    }
  }

  async function handleRenamePasskey(id: string) {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`/api/auth/passkeys/credentials/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        setCredentials((prev) => prev.map((c) => (c.id === id ? { ...c, name: editingName.trim() } : c)));
        setEditingId(null);
        setEditingName("");
        setMsg({ type: "success", text: "Passkey renamed" });
      }
    } catch {
      setMsg({ type: "error", text: "Failed to rename passkey" });
    }
  }

  async function handleDeletePasskey(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove passkey "${name}"?`)) return;
    try {
      const res = await fetch(`/api/auth/passkeys/credentials/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
        setMsg({ type: "success", text: "Passkey removed" });
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to remove passkey" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error removing passkey" });
    }
  }

  // --- MFA Actions ---
  async function startMfaSetup() {
    setMsg(null);
    setMfaVerifyCode("");
    setBackupCodesReceived(null);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMfaSetupData(data);
        setShowMfaSetupModal(true);
      } else {
        setMsg({ type: "error", text: data.error || "Failed to initiate MFA setup" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error initiating MFA setup" });
    }
  }

  async function handleVerifyMfaSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaVerifyCode.trim()) return;
    setVerifyingMfa(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaVerifyCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setBackupCodesReceived(data.backupCodes || []);
        loadAllData();
      } else {
        setMsg({ type: "error", text: data.error || "Verification failed" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error during verification" });
    } finally {
      setVerifyingMfa(false);
    }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!disablePassword) return;
    setDisablingMfa(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowMfaDisableModal(false);
        setDisablePassword("");
        setMsg({ type: "success", text: "Multi-Factor Authentication disabled" });
        loadAllData();
      } else {
        setMsg({ type: "error", text: data.error || "Failed to disable MFA" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error disabling MFA" });
    } finally {
      setDisablingMfa(false);
    }
  }

  function downloadBackupCodes(codes: string[]) {
    const text = `BOILERPLATE APP EMERGENCY RECOVERY CODES\nGenerated: ${new Date().toLocaleString()}\n\nEach code can be used once if you lose access to your Authenticator app:\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boilerplate-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function getMethodBadge(method: string) {
    switch (method) {
      case "passkey":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span>🔑</span> Passkey
          </span>
        );
      case "totp_authenticator":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <span>🛡️</span> MFA Authenticator
          </span>
        );
      case "mfa_backup_code":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span>🎫</span> Recovery Code
          </span>
        );
      case "trusted_device":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <span>💻</span> Trusted Device
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-500/10 text-gray-600 dark:text-slate-400 border border-gray-500/20">
            <span>🔒</span> Password
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Link href="/profile" className="hover:text-emerald-500 transition">Your Profile</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Security</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Personal Security</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Account Protection
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Manage your passkeys, multi-factor authentication, passwords, and review login activity.
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

      {/* Security Hub Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Passkeys Tile */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Passkeys (WebAuthn)</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Biometric & hardware tokens (Touch ID, Windows Hello, YubiKey).
                  </p>
                </div>
              </div>

              {passkeysEnabled ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-500/10 text-gray-600 dark:text-slate-400 border border-gray-500/20">
                  Disabled
                </span>
              )}
            </div>

            {!passkeysEnabled ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                Passkey authentication is disabled system-wide by the administrator.
              </p>
            ) : credentials.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-950/30">
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">No passkeys enrolled yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Add biometric sensor or a YubiKey for instant sign-in</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-48 overflow-y-auto pr-1">
                {credentials.map((cred) => (
                  <div key={cred.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        title={cred.deviceType === "singleDevice" ? "Hardware Security Key" : "Biometrics / Synced Keychain"}
                        className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0"
                      >
                        {cred.deviceType === "singleDevice" ? (
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>

                      <div className="min-w-0">
                        {editingId === cred.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-xs rounded px-1.5 py-0.5 focus:outline-none"
                              autoFocus
                            />
                            <button onClick={() => handleRenamePasskey(cred.id)} className="text-[11px] text-emerald-500 font-semibold">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-[11px] text-gray-400">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{cred.name}</p>
                            <button onClick={() => { setEditingId(cred.id); setEditingName(cred.name); }} className="text-gray-400 hover:text-gray-600">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">Added {new Date(cred.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <button onClick={() => handleDeletePasskey(cred.id, cred.name)} className="text-gray-400 hover:text-red-500 p-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {passkeysEnabled && (
            <button
              onClick={() => setShowAddPasskeyModal(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Register New Passkey
            </button>
          )}
        </div>

        {/* Multi-Factor Authentication (MFA) Tile */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Authenticator App (TOTP)</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Google Authenticator, Microsoft Authenticator, 1Password.
                  </p>
                </div>
              </div>

              {mfaStatus?.enabled ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Enrolled
                </span>
              ) : mfaSystemEnabled ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-500/10 text-gray-600 dark:text-slate-400 border border-gray-500/20">
                  Not Enrolled
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-500/10 text-gray-600 dark:text-slate-400 border border-gray-500/20">
                  Disabled
                </span>
              )}
            </div>

            {!mfaSystemEnabled ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                Multi-Factor Authentication is disabled system-wide by the administrator.
              </p>
            ) : mfaStatus?.enabled ? (
              <div className="space-y-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-slate-400">Account 2FA Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active & Protected</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-slate-400">Emergency Backup Codes</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">{mfaStatus.backupCodesRemaining} remaining</span>
                </div>
                {mfaStatus.createdAt && (
                  <p className="text-[11px] text-gray-400">Enrolled on {new Date(mfaStatus.createdAt).toLocaleDateString()}</p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-950/30">
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">MFA is not yet active on your account</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Scan a QR code to enable 6-digit one-time password security</p>
              </div>
            )}
          </div>

          {mfaSystemEnabled && (
            mfaStatus?.enabled ? (
              <button
                onClick={() => setShowMfaDisableModal(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 font-semibold text-xs rounded-xl border border-red-200 dark:border-red-900/40 transition"
              >
                Disable 2FA Protection
              </button>
            ) : (
              <button
                onClick={startMfaSetup}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Setup Authenticator App
              </button>
            )
          )}
        </div>

        {/* Password Tile */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Coming Soon
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Account Password</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Update your primary password, review complexity requirements, and manage password expiration policies.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400">
            Encrypted BCrypt credentials
          </div>
        </div>

        {/* Forensic Watermarking Status Tile */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Admin Managed
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Forensic Watermarking</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Screens in this platform are tagged with a subtle 45-degree diagonal forensic overlay and scannable QR verification to prevent unauthorized data leaks.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400">
            Automated session verification & screenshot protection
          </div>
        </div>
      </div>

      {/* Security Audit & Sign-In Activity Section */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Security & Sign-In Activity</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Review recent authentications, sign-in methods (Password, Passkeys, MFA), browser environments, and IP addresses.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
            {auditLogs.length} Events
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 py-4 text-center">No sign-in activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  {getMethodBadge(log.method)}

                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {log.browser || "Web Browser"} {log.os ? `on ${log.os}` : ""}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                      <span className="font-mono">{log.ip}</span>
                      <span>&bull;</span>
                      <span>{log.action}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-gray-400 flex-shrink-0">
                  <p>{new Date(log.createdAt).toLocaleDateString()}</p>
                  <p>{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Passkey Modal */}
      {showAddPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Register a New Passkey</h3>
              <button onClick={() => !registeringPasskey && setShowAddPasskeyModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              When you click Continue, your browser will prompt you to use your biometric sensor (Touch ID, Face ID, Windows Hello) or insert a USB/NFC hardware security key (YubiKey).
            </p>

            <form onSubmit={handleRegisterPasskey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Passkey Nickname (Optional)
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. MacBook Touch ID or YubiKey 5C"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 transition"
                  disabled={registeringPasskey}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPasskeyModal(false)}
                  disabled={registeringPasskey}
                  className="px-3.5 py-2 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registeringPasskey}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold text-xs rounded-lg transition shadow-sm"
                >
                  {registeringPasskey ? "Waiting for Passkey…" : "Continue & Authenticate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Setup Modal */}
      {showMfaSetupModal && mfaSetupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {backupCodesReceived ? "Save Recovery Codes" : "Set Up Authenticator App"}
              </h3>
              <button
                onClick={() => {
                  setShowMfaSetupModal(false);
                  setBackupCodesReceived(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            {!backupCodesReceived ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  Scan this QR code with Google Authenticator, Microsoft Authenticator, or 1Password.
                </p>

                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 max-w-[220px] mx-auto shadow-inner">
                  <img src={mfaSetupData.qrCodeDataUrl} alt="MFA QR Code" className="w-44 h-44 object-contain" />
                </div>

                <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Manual Entry Key</p>
                  <p className="font-mono text-xs font-bold text-gray-900 dark:text-white select-all break-all">
                    {mfaSetupData.secret}
                  </p>
                </div>

                <form onSubmit={handleVerifyMfaSetup} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 text-center">
                      Enter 6-Digit Code to Confirm
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaVerifyCode}
                      onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full text-center tracking-widest font-mono text-lg bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg py-2 focus:outline-none focus:border-indigo-500"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMfaSetupModal(false)}
                      className="px-3.5 py-2 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={verifyingMfa || mfaVerifyCode.length !== 6}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-semibold text-xs rounded-lg shadow-sm transition"
                    >
                      {verifyingMfa ? "Verifying…" : "Activate 2FA"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="font-bold">2FA is now activated!</p>
                  <p className="mt-0.5">
                    Save these single-use recovery codes in a safe place. If you ever lose your phone or authenticator app, each code can be used once to sign in.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                  {backupCodesReceived.map((code, idx) => (
                    <div key={idx} className="font-mono text-xs font-bold text-gray-900 dark:text-white text-center py-1 bg-white dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-700">
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadBackupCodes(backupCodesReceived)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 rounded-lg transition"
                  >
                    Download .txt
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMfaSetupModal(false);
                      setBackupCodesReceived(null);
                      setMsg({ type: "success", text: "Multi-Factor Authentication enabled successfully!" });
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg transition"
                  >
                    I Have Saved My Codes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MFA Disable Modal */}
      {showMfaDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Disable 2FA Protection?</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Please enter your account password to confirm disabling Multi-Factor Authentication.
            </p>

            <form onSubmit={handleDisableMfa} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Account Password
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMfaDisableModal(false)}
                  disabled={disablingMfa}
                  className="px-3.5 py-2 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disablingMfa || !disablePassword}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold text-xs rounded-lg transition"
                >
                  {disablingMfa ? "Disabling…" : "Confirm & Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
