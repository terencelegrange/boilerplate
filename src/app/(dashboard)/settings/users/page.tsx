"use client";

import { useEffect, useState } from "react";

interface User { id: number; email: string; name: string | null; role: string; status: string; created_at: string; }

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    pending:  "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s[status] ?? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700"}`}>{status}</span>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/users");
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function update(id: number, patch: Record<string, string>) {
    setBusy(id);
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await load(); setBusy(null);
  }

  async function del(id: number) {
    if (!confirm("Delete this user permanently?")) return;
    setBusy(id);
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    await load(); setBusy(null);
  }

  const pending  = users.filter((u) => u.status === "pending");
  const filtered = filter === "pending" ? pending : users;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage user accounts, roles, and approval status</p>
      </div>

      <div className="space-y-5">
        {pending.length > 0 && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-3">
            <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              {pending.length} user{pending.length !== 1 ? "s" : ""} waiting for approval
            </span>
          </div>
        )}

        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
          {(["pending", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filter === f ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"}`}>
              {f === "pending" ? `Pending (${pending.length})` : "All Users"}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {["User", "Role", "Status", "Joined", ""].map((h) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider ${h ? "text-left" : "text-right"}`}>
                    {h || "Actions"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                  {filter === "pending" ? "No pending approvals." : "No users found."}
                </td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{(u.name ?? u.email)[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{u.name ?? "—"}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select value={u.role} disabled={busy === u.id} onChange={(e) => update(u.id, { role: e.target.value })}
                      className="bg-transparent border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {u.status === "pending" && <>
                        <button onClick={() => update(u.id, { status: "approved" })} disabled={busy === u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-50">Approve</button>
                        <button onClick={() => update(u.id, { status: "rejected" })} disabled={busy === u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50">Reject</button>
                      </>}
                      {u.status === "approved" && <button onClick={() => update(u.id, { status: "rejected" })} disabled={busy === u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition disabled:opacity-50">Revoke</button>}
                      {u.status === "rejected" && <button onClick={() => update(u.id, { status: "approved" })} disabled={busy === u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-50">Re-approve</button>}
                      <button onClick={() => del(u.id)} disabled={busy === u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
