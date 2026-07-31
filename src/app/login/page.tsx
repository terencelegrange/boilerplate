"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RememberedProfile {
  id: number;
  email: string;
  name: string | null;
  avatar: number | null;
}

function getDisplayAvatar(av: number | null, uid: number): number {
  if (av !== null && av >= 1 && av <= 127) return av;
  return ((uid - 1) % 127) + 1;
}

function readRemembered(): RememberedProfile[] {
  const raw = document.cookie.split("; ").find((c) => c.startsWith("bp_remembered="))?.split("=")[1];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<RememberedProfile[]>([]);
  const [selected, setSelected] = useState<RememberedProfile | null>(null);
  const [showFullForm, setShowFullForm] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProfiles(readRemembered());
  }, []);

  async function submitLogin(loginEmail: string, loginPassword: string, remember: boolean) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword, rememberMe: remember }),
      });
      if (res.ok) {
        router.push("/");
      } else {
        setError((await res.json()).error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleFullSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitLogin(email, password, rememberMe);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    submitLogin(selected.email, password, true);
  }

  const showPicker = profiles.length > 0 && !showFullForm;

  return (
    <div className="min-h-full flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {showPicker && !selected ? "Who's signing in?" : "Sign in to your account"}
          </p>
        </div>

        {showPicker && !selected && (
          <div>
            <div className="grid grid-cols-3 gap-4 justify-items-center mb-6">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setError(""); }}
                  className="flex flex-col items-center gap-2 group"
                >
                  <img
                    src={`/avatars/${getDisplayAvatar(p.avatar, p.id)}.png`}
                    alt={p.name ?? p.email}
                    className="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-emerald-500 transition"
                  />
                  <span className="text-xs text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white truncate max-w-[5rem]">
                    {p.name ?? p.email}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-slate-500">
              <button onClick={() => setShowFullForm(true)} className="text-emerald-500 hover:text-emerald-400 transition">
                Sign in with a different account
              </button>
            </p>
          </div>
        )}

        {showPicker && selected && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center mb-5">
              <img
                src={`/avatars/${getDisplayAvatar(selected.avatar, selected.id)}.png`}
                alt={selected.name ?? selected.email}
                className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 mb-2"
              />
              <p className="text-sm font-medium text-gray-900 dark:text-white">{selected.name ?? selected.email}</p>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
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
            <p className="text-center text-sm text-gray-500 dark:text-slate-500 mt-4">
              <button onClick={() => { setSelected(null); setPassword(""); setError(""); }} className="text-emerald-500 hover:text-emerald-400 transition">
                Not you?
              </button>
            </p>
          </div>
        )}

        {!showPicker && (
          <>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleFullSubmit} className="space-y-4">
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
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 select-none">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500" />
                  Remember me
                </label>
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition mt-2">
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>

            <p className="text-center text-sm text-gray-500 dark:text-slate-500 mt-4">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-emerald-500 hover:text-emerald-400 transition">Request access</Link>
            </p>
            {profiles.length > 0 && showFullForm && (
              <p className="text-center text-sm text-gray-500 dark:text-slate-500 mt-2">
                <button onClick={() => setShowFullForm(false)} className="text-emerald-500 hover:text-emerald-400 transition">
                  Back to profiles
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
