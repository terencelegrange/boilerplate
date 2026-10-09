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

export default function PersonalSecurityPage() {
  const [passkeysEnabled, setPasskeysEnabled] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cfgRes, credRes] = await Promise.all([
        fetch("/api/auth/passkeys/config"),
        fetch("/api/auth/passkeys/credentials"),
      ]);

      const cfgData = await cfgRes.json();
      setPasskeysEnabled(!!cfgData.enabled);

      if (credRes.ok) {
        const credData = await credRes.json();
        setCredentials(credData.credentials || []);
      }
    } catch {
      setMsg({ type: "error", text: "Failed to load security settings" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterPasskey(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setRegistering(true);

    try {
      // 1. Fetch registration options from server
      const optRes = await fetch("/api/auth/passkeys/register/options", {
        method: "POST",
      });
      const optData = await optRes.json();

      if (!optRes.ok) {
        throw new Error(optData.error || "Failed to initialize passkey registration");
      }

      // 2. Prompt user via browser WebAuthn API (supports both Touch ID/Face ID and YubiKey)
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optData.options });
      } catch (err: any) {
        if (err.name === "NotAllowedError" || err.message?.includes("timed out") || err.message?.includes("cancelled")) {
          throw new Error("Passkey registration cancelled or timed out.");
        }
        throw new Error(err.message || "Failed to complete passkey prompt.");
      }

      // 3. Send verification to server
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
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Server verification failed");
      }

      setMsg({ type: "success", text: "Passkey registered successfully! You can now use it to sign in." });
      setShowAddModal(false);
      setKeyName("");
      loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Passkey registration failed" });
    } finally {
      setRegistering(false);
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`/api/auth/passkeys/credentials/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        setCredentials((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: editingName.trim() } : c))
        );
        setEditingId(null);
        setEditingName("");
        setMsg({ type: "success", text: "Passkey renamed" });
      }
    } catch {
      setMsg({ type: "error", text: "Failed to rename passkey" });
    }
  }

  async function handleDelete(id: string, name: string) {
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
          Manage your passkeys, multi-factor authentication, passwords, and active credentials.
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
        {/* Passkeys Tile (ACTIVE) */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Passkeys (FIDO2 / WebAuthn)</h2>
                  {passkeysEnabled ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-500/10 text-gray-600 dark:text-slate-400 border border-gray-500/20">
                      Disabled System-Wide
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
                  Sign in instantly using Touch ID, Face ID, Windows Hello, or external hardware security keys (YubiKey).
                </p>
              </div>
            </div>

            {passkeysEnabled && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs rounded-xl shadow-sm transition flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Register New Passkey
              </button>
            )}
          </div>

          {!passkeysEnabled ? (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              Passkey authentication is currently turned off system-wide by the administrator. Contact your system admin to enable passkeys in Platform Security Settings.
            </div>
          ) : (
            <div>
              {loading ? (
                <div className="py-8 text-center text-xs text-gray-400 dark:text-slate-500">
                  Loading registered passkeys…
                </div>
              ) : credentials.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-950/30">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">No passkeys registered yet</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Add this device&apos;s biometric sensor (Touch ID / Windows Hello) or a hardware YubiKey for fast, passwordless sign-ins.
                  </p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs rounded-lg transition"
                  >
                    Add Your First Passkey
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {credentials.map((cred) => (
                    <div key={cred.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          title={cred.deviceType === "singleDevice" ? "Hardware Security Key" : "Platform Biometrics / Synced Keychain"}
                          className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0"
                        >
                          {cred.deviceType === "singleDevice" ? (
                            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>

                        <div className="min-w-0">
                          {editingId === cred.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-xs text-gray-900 dark:text-white rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleRename(cred.id)}
                                className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName("");
                                }}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {cred.name}
                              </p>
                              <button
                                onClick={() => {
                                  setEditingId(cred.id);
                                  setEditingName(cred.name);
                                }}
                                title="Rename passkey"
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                </svg>
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                            <span>
                              {cred.deviceType === "singleDevice" ? "Hardware Security Key" : "Biometric / Synced Passkey"}
                            </span>
                            <span>&bull;</span>
                            <span>Added {new Date(cred.createdAt).toLocaleDateString()}</span>
                            {cred.lastUsed && (
                              <>
                                <span>&bull;</span>
                                <span>Last used {new Date(cred.lastUsed).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(cred.id, cred.name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                        title="Delete passkey"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Tile (Coming Soon) */}
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
                Update your primary password, set recovery answers, and manage password rotation policies.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400">
            Encrypted BCrypt credentials
          </div>
        </div>

        {/* Multi-Factor Authentication Tile (Coming Soon) */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Coming Soon
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Multi-Factor Authentication (MFA)</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Connect Authenticator apps (Google Authenticator, Microsoft Authenticator, 1Password) using TOTP 6-digit verification codes.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400">
            TOTP 2FA & Emergency Recovery
          </div>
        </div>

        {/* Audit Log Tile (Coming Soon) */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Coming Soon
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Security & Sign-In Activity</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Inspect your active sessions, recent login locations, IP addresses, and security audit log events.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400">
            Session History & Geolocation
          </div>
        </div>
      </div>

      {/* Add Passkey Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Register a New Passkey</h3>
              <button
                onClick={() => !registering && setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                &times;
              </button>
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
                  disabled={registering}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={registering}
                  className="px-3.5 py-2 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold text-xs rounded-lg transition shadow-sm"
                >
                  {registering ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Waiting for Passkey…
                    </>
                  ) : (
                    "Continue & Authenticate"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
