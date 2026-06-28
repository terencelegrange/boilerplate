"use client";

import { useEffect, useState } from "react";

function getDisplayAvatar(av: number | null, uid: number | null): number {
  if (av !== null && av >= 1 && av <= 127) return av;
  if (!uid || uid <= 0) return 1;
  return ((uid - 1) % 127) + 1;
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<number | null>(null);

  // Identity form
  const [avatar, setAvatar] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identitySuccess, setIdentitySuccess] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    const token = document.cookie.split("; ").find((c) => c.startsWith("bp_token="))?.split("=")[1];
    if (token) {
      try {
        const p = JSON.parse(atob(token.split(".")[1]));
        setUserId(parseInt(p.sub ?? "0", 10) || null);
      } catch { /* ignore */ }
    }

    fetch("/api/me/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setAvatar(data.avatar ?? null);
        setName(data.name ?? "");
        setEmail(data.email ?? "");
      })
      .catch(() => {});
  }, []);

  async function randomizeAvatar() {
    const current = getDisplayAvatar(avatar, userId);
    let next: number;
    do { next = Math.floor(Math.random() * 127) + 1; } while (next === current);
    setAvatar(next);
    await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: next }),
    });
  }

  async function handleIdentitySave(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(null);
    setIdentitySaving(true);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, avatar }),
      });
      const data = await r.json();
      if (!r.ok) { setIdentityError(data.error ?? "Failed to save"); return; }
      setIdentitySuccess(true);
      setTimeout(() => setIdentitySuccess(false), 3000);
    } catch {
      setIdentityError("Network error - please try again");
    } finally {
      setIdentitySaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) { setPwError("New passwords do not match"); return; }
    setPwSaving(true);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await r.json();
      if (!r.ok) { setPwError(data.error ?? "Failed to update password"); return; }
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError("Network error - please try again");
    } finally {
      setPwSaving(false);
    }
  }

  const displayAvatar = getDisplayAvatar(avatar, userId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage your account details and password</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Identity card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Identity</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">Update your name, email, and avatar</p>

          <form onSubmit={handleIdentitySave} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer flex-shrink-0" onClick={randomizeAvatar}>
                <img
                  src={`/avatars/${displayAvatar}.png`}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/30 group-hover:border-emerald-500 transition"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">Click avatar to randomize</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {identityError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{identityError}</p>
            )}
            {identitySuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">Profile updated successfully</p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={identitySaving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                {identitySaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Password card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Change Password</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">You must enter your current password to set a new one</p>

          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Current password</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">New password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Confirm new password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            {pwError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">Password updated successfully</p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={pwSaving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                {pwSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
