"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "@/data/nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [avatar, setAvatar] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCurrentPw, setEditCurrentPw] = useState("");
  const [editNewPw, setEditNewPw] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({ menu: true, dashboard: true, signup: true });
  const [allowedNavKeys, setAllowedNavKeys] = useState<string[]>(["dashboard", "settings"]);

  useEffect(() => {
    fetch("/api/feature-flags")
      .then((r) => r.json())
      .then((data: Record<string, { enabled: boolean }>) => {
        const map: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(data)) map[k] = v.enabled;
        setFlags(map);
      })
      .catch(() => { /* keep defaults */ });

    fetch("/api/rbac/me")
      .then((r) => r.json())
      .then((data: { navKeys: string[] }) => { if (data.navKeys) setAllowedNavKeys(data.navKeys); })
      .catch(() => { /* keep defaults */ });

    const token = document.cookie.split("; ").find((c) => c.startsWith("bp_token="))?.split("=")[1];
    if (token) {
      try {
        const p = JSON.parse(atob(token.split(".")[1]));
        setRole(p.role ?? null);
        setUserName(p.name ?? p.email ?? null);
        setUserId(parseInt(p.sub ?? "0", 10) || null);
      } catch { /* ignore */ }
    }
    const theme = document.cookie.split("; ").find((c) => c.startsWith("bp_theme="))?.split("=")[1];
    setIsDark(theme !== "light");
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowEditForm(false);
        setEditError(null);
        setEditSuccess(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    setIsDark(next === "dark");
    await fetch("/api/me/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function getDisplayAvatar(av: number | null, uid: number | null): number {
    if (av !== null && av >= 1 && av <= 127) return av;
    if (!uid || uid <= 0) return 1;
    return ((uid - 1) % 127) + 1;
  }

  async function openDropdown() {
    const next = !showDropdown;
    if (next) {
      try {
        const r = await fetch("/api/me/profile");
        if (r.ok) {
          const data = await r.json();
          setAvatar(data.avatar ?? null);
          setEditName(data.name ?? "");
          setEditEmail(data.email ?? "");
        }
      } catch { /* ignore */ }
    }
    setShowDropdown(next);
    setShowEditForm(false);
    setEditError(null);
    setEditSuccess(false);
  }

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

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    setEditSaving(true);
    try {
      const body: Record<string, string> = { name: editName, email: editEmail };
      if (editNewPw) { body.currentPassword = editCurrentPw; body.newPassword = editNewPw; }
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setEditError(data.error ?? "Failed to save"); return; }
      setEditSuccess(true);
      setUserName(data.name ?? editName);
      setEditCurrentPw("");
      setEditNewPw("");
      setTimeout(() => { setEditSuccess(false); setShowEditForm(false); }, 1200);
    } catch {
      setEditError("Network error — please try again");
    } finally {
      setEditSaving(false);
    }
  }

  const navItems = flags.menu
    ? NAV_ITEMS.filter((item) => allowedNavKeys.includes(item.key))
    : [];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {!flags.menu ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500 italic">Navigation disabled</p>
          ) : navItems.length === 0 ? null : navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.key} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon.split(" M").map((part, i) => (
                    <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={i === 0 ? part : "M" + part} />
                  ))}
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-200 dark:border-slate-800 space-y-1">
          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-950">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-slate-950/80 backdrop-blur border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex items-center justify-end gap-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
            {isDark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {userName && (
            <div className="relative" ref={dropdownRef}>
              <button onClick={openDropdown}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition group">
                <img
                  src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
                  alt="avatar"
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/30"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">{userName}</span>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showDropdown ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                  {/* Avatar + identity header */}
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800">
                    <div className="relative group/av cursor-pointer flex-shrink-0" onClick={randomizeAvatar}>
                      <img
                        src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
                        alt="avatar"
                        className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 group-hover/av:border-emerald-500 transition"
                      />
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/av:opacity-100 transition flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Click avatar to randomize</p>
                    </div>
                  </div>

                  {/* Edit profile section */}
                  <div className="px-4 py-2">
                    {!showEditForm ? (
                      <button
                        onClick={() => { setShowEditForm(true); setEditError(null); setEditSuccess(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit Profile
                      </button>
                    ) : editSuccess ? (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-3 justify-center text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Profile updated
                      </div>
                    ) : (
                      <form onSubmit={handleEditSave} className="space-y-3 py-2">
                        {editError && (
                          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{editError}</p>
                        )}
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          required
                          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                        <div className="border-t border-gray-100 dark:border-slate-800 pt-2 space-y-2">
                          <input
                            type="password"
                            value={editCurrentPw}
                            onChange={(e) => setEditCurrentPw(e.target.value)}
                            placeholder="Current password"
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                          <input
                            type="password"
                            value={editNewPw}
                            onChange={(e) => setEditNewPw(e.target.value)}
                            placeholder="New password"
                            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowEditForm(false); setEditError(null); }}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editSaving}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                            {editSaving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-2">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
