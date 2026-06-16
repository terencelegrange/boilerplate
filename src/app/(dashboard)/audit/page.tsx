"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: number;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: string | null;
  ip: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:            "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  LOGOUT:           "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700",
  LOGIN_FAILED:     "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  SIGNUP:           "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  USER_APPROVED:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  USER_REJECTED:    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  USER_DELETED:     "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  USER_UPDATED:     "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  THEME_CHANGED:    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${style}`}>
      {action}
    </span>
  );
}

const ACTIONS = ["", "LOGIN", "LOGOUT", "LOGIN_FAILED", "SIGNUP", "USER_APPROVED", "USER_REJECTED", "USER_DELETED", "USER_UPDATED", "THEME_CHANGED"];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filter) params.set("action", filter);
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, filter]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">All database interactions and system events</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 dark:text-slate-400">Filter:</label>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a || "All actions"}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-500 dark:text-slate-400">{total} total events</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-800">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Resource</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-5 py-3">
                    <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
                  No audit events found.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3"><ActionBadge action={e.action} /></td>
                  <td className="px-5 py-3 text-xs text-gray-700 dark:text-slate-300">
                    {e.user_name ?? e.user_email ?? <span className="italic text-gray-400 dark:text-slate-500">system</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {e.resource ? `${e.resource}${e.resource_id ? ` #${e.resource_id}` : ""}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-xs truncate">
                    {e.details ? (
                      <span title={e.details}>{e.details.length > 60 ? e.details.slice(0, 60) + "…" : e.details}</span>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 dark:text-slate-500">{e.ip ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 transition">
            Previous
          </button>
          <span className="text-xs text-gray-500 dark:text-slate-400">Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 transition">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
