"use client";

import { useEffect, useState } from "react";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<{ id: number; date: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((d) => { setEntries(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const grouped = entries.reduce<Record<string, string[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e.description);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Change Log</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Development changes and feature releases, most recent first</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 animate-pulse space-y-2">
              <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-80 bg-gray-100 dark:bg-slate-800 rounded" />
              <div className="h-3 w-64 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">No changelog entries yet.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <ul className="px-5 py-3 space-y-2">
                {items.map((desc, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {desc}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
