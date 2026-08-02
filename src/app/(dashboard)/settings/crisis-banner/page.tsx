"use client";

import { useEffect, useState } from "react";

export default function CrisisBannerPage() {
  const [message, setMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/crisis-banner");
    if (r.ok) {
      const data = await r.json();
      setMessage(data.message ?? "");
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate ?? "");
      setEnabled(data.enabled ?? false);
      setActive(data.active ?? false);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const r = await fetch("/api/crisis-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, startDate: startDate || null, endDate: endDate || null, enabled }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Failed to save"); return; }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch {
      setError("Network error - please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crisis Banner</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Show a site-wide announcement banner on every page, including login and signup, during a scheduled window
        </p>
      </div>

      <div className="max-w-xl">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
          {!loading && (
            <div className={`mb-5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              active
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-red-500" : "bg-gray-400"}`} />
              {active ? "Currently showing on all pages" : "Not currently showing"}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="e.g. Scheduled maintenance on Saturday from 2am-4am AEST"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">End date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 select-none">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500" />
              Enabled
            </label>
            <p className="text-xs text-gray-400 dark:text-slate-500 -mt-2">
              The banner only shows when enabled AND today falls within the start/end dates (leave a date blank for no limit on that side).
            </p>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">Crisis banner saved</p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
