"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDisplayAvatar } from "@/lib/avatar";
import { getRememberedProfiles, rememberProfile, forgetProfile, RememberedProfile } from "@/lib/profiles";

type View = "profiles" | "password" | "form";

export default function LoginPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<RememberedProfile[]>([]);
  const [view, setView] = useState<View>("form");
  const [activeProfile, setActiveProfile] = useState<RememberedProfile | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const remembered = getRememberedProfiles();
    setProfiles(remembered);
    setView(remembered.length > 0 ? "profiles" : "form");
  }, []);

  async function performLogin(loginEmail: string, loginPassword: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        rememberProfile({
          id: data.user?.id ?? null,
          email: data.user?.email ?? loginEmail,
          name: data.user?.name ?? null,
          avatar: data.user?.avatar ?? null,
        });
        router.push("/");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    performLogin(email, password);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProfile) return;
    performLogin(activeProfile.email, password);
  }

  function selectProfile(profile: RememberedProfile) {
    setActiveProfile(profile);
    setPassword("");
    setError("");
    setView("password");
  }

  function handleForget(e: React.MouseEvent, profileEmail: string) {
    e.stopPropagation();
    forgetProfile(profileEmail);
    const remaining = profiles.filter((p) => p.email !== profileEmail);
    setProfiles(remaining);
    if (remaining.length === 0) setView("form");
  }

  function backToProfiles() {
    setActiveProfile(null);
    setPassword("");
    setError("");
    setView(profiles.length > 0 ? "profiles" : "form");
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-950">
      <div className={view === "profiles" ? "w-full max-w-2xl" : "w-full max-w-sm"}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {view === "profiles" ? "Who's signing in?" : "Sign in to your account"}
          </p>
        </div>

        {/* Netflix-style profile picker */}
        {view === "profiles" && (
          <div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-6 justify-items-center mb-8">
              {profiles.map((p) => (
                <button
                  key={p.email}
                  onClick={() => selectProfile(p)}
                  className="group flex flex-col items-center gap-2 w-20"
                >
                  <div className="relative">
                    <img
                      src={`/avatars/${getDisplayAvatar(p.avatar, p.id)}.png`}
                      alt={p.name ?? p.email}
                      className="w-20 h-20 rounded-xl object-cover border-2 border-transparent group-hover:border-emerald-500 transition"
                    />
                    <span
                      role="button"
                      aria-label={`Forget ${p.name ?? p.email}`}
                      onClick={(e) => handleForget(e, p.email)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900/80 dark:bg-slate-800 text-white border border-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white truncate w-full text-center">
                    {p.name ?? p.email}
                  </span>
                </button>
              ))}

              <button
                onClick={() => setView("form")}
                className="group flex flex-col items-center gap-2 w-20"
              >
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center group-hover:border-emerald-500 transition">
                  <svg className="w-8 h-8 text-gray-400 dark:text-slate-500 group-hover:text-emerald-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white text-center">
                  Add Account
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Password step for a selected remembered profile */}
        {view === "password" && activeProfile && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center mb-5">
              <img
                src={`/avatars/${getDisplayAvatar(activeProfile.avatar, activeProfile.id)}.png`}
                alt={activeProfile.name ?? activeProfile.email}
                className="w-16 h-16 rounded-xl object-cover mb-3"
              />
              <p className="text-sm font-medium text-gray-900 dark:text-white">{activeProfile.name ?? activeProfile.email}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">{activeProfile.email}</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition mt-2">
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <button onClick={backToProfiles} className="w-full text-center text-sm text-gray-500 dark:text-slate-500 hover:text-emerald-500 transition mt-4">
              ← Back to profiles
            </button>
          </div>
        )}

        {/* Full email + password form */}
        {view === "form" && (
          <div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition mt-2">
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>

            {profiles.length > 0 && (
              <button onClick={backToProfiles} className="w-full text-center text-sm text-gray-500 dark:text-slate-500 hover:text-emerald-500 transition mt-4">
                ← Back to profiles
              </button>
            )}
          </div>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-slate-500 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-emerald-500 hover:text-emerald-400 transition">Request access</Link>
        </p>
      </div>
    </div>
  );
}
