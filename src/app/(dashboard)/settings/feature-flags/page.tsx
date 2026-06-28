"use client";

import { useEffect, useState } from "react";

interface FeatureFlag { key: string; enabled: boolean; label: string; description: string; }

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/feature-flags");
    if (r.ok) {
      const data = await r.json();
      setFlags(Object.values(data));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(key: string, current: boolean) {
    setBusy(key);
    await fetch(`/api/feature-flags/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !current }),
    });
    await load();
    setBusy(null);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Flags</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Toggle features on or off without redeploying</p>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">Changes take effect immediately.</p>
        <div className="grid grid-cols-1 gap-3">
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 w-64 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
          )) : flags.map((f) => (
            <div key={f.key} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{f.description}</p>
                <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-1">{f.key}</p>
              </div>
              <button onClick={() => toggle(f.key, f.enabled)} disabled={busy === f.key}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${f.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-600"}`}
                role="switch" aria-checked={f.enabled}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${f.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
