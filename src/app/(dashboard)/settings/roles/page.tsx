"use client";

import { useEffect, useState } from "react";
import { NAV_ITEMS, ROLES } from "@/data/nav";

export default function RolesPage() {
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/rbac").then((r) => r.json()).then((d) => { setPermissions(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function toggle(role: string, key: string) {
    setPermissions((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [role]: next };
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch("/api/rbac", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(permissions) });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Configure which navigation items each role can access</p>
      </div>

      {loading ? (
        <div className="h-32 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-slate-400">Changes take effect on next login or page refresh.</p>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Nav Item</th>
                  {ROLES.map((r) => (
                    <th key={r.key} className="px-5 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      <div>{r.label}</div>
                      <div className="text-gray-400 dark:text-slate-500 font-normal normal-case">{r.description}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {NAV_ITEMS.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{item.href}</p>
                    </td>
                    {ROLES.map((r) => {
                      const checked = (permissions[r.key] ?? []).includes(item.key);
                      return (
                        <td key={r.key} className="px-5 py-3 text-center">
                          <button onClick={() => toggle(r.key, item.key)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition ${checked ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-slate-600 hover:border-emerald-400"}`}>
                            {checked && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved!</span>}
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save permissions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
