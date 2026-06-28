"use client";

import { useEffect, useState } from "react";

interface ApiKey {
  id: number; prefix: string; name: string; contact: string;
  expires_at: string | null; created_at: string; last_used: string | null;
  active: boolean; created_by_email: string | null;
}

export default function ApiAccessPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ key: string; prefix: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/api-keys");
    if (r.ok) setKeys(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const r = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, contact: newContact, expiresAt: newExpiry || null }),
    });
    const data = await r.json();
    setCreating(false);
    if (r.ok) {
      setCreated({ key: data.key, prefix: data.prefix });
      setShowForm(false); setNewName(""); setNewContact(""); setNewExpiry("");
      await load();
    }
  }

  async function toggleActive(id: number, current: boolean) {
    setBusy(id);
    await fetch(`/api/api-keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !current }) });
    await load(); setBusy(null);
  }

  async function deleteKey(id: number) {
    if (!confirm("Delete this API key permanently?")) return;
    setBusy(id);
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    await load(); setBusy(null);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Access</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage API keys for programmatic access to the platform</p>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            API keys grant full access via <code className="text-xs bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> header.
          </p>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Key
          </button>
        </div>

        {created && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Key created — copy it now. It will not be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 font-mono text-gray-800 dark:text-slate-200 break-all">{created.key}</code>
              <button onClick={() => navigator.clipboard.writeText(created.key)}
                className="px-3 py-2 text-xs rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition flex-shrink-0">Copy</button>
            </div>
            <button onClick={() => setCreated(null)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Dismiss</button>
          </div>
        )}

        {showForm && (
          <form onSubmit={create} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Generate new API key</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Name / Label</label>
                <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Mobile App"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Contact</label>
                <input required value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="email or name"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Expires <span className="text-gray-400">(leave blank for indefinite)</span></label>
                <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition">Cancel</button>
              <button type="submit" disabled={creating}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">{creating ? "Generating..." : "Generate key"}</button>
            </div>
          </form>
        )}

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {["Key", "Name", "Contact", "Expires", "Last Used", "Status", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? Array.from({ length: 2 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
              )) : keys.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">No API keys yet.</td></tr>
              ) : keys.map((k) => {
                const expired = k.expires_at ? new Date(k.expires_at) < new Date() : false;
                return (
                  <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3"><code className="text-xs font-mono text-gray-600 dark:text-slate-300">{k.prefix}...</code></td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{k.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{k.contact}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                      {k.expires_at
                        ? <span className={expired ? "text-red-500" : ""}>{new Date(k.expires_at).toLocaleDateString()}{expired ? " (expired)" : ""}</span>
                        : <span className="italic text-gray-400 dark:text-slate-500">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">{k.last_used ? new Date(k.last_used).toLocaleString() : "Never"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${k.active && !expired ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"}`}>
                        {k.active && !expired ? "Active" : expired ? "Expired" : "Revoked"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => toggleActive(k.id, k.active)} disabled={busy === k.id || expired}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition disabled:opacity-50">
                          {k.active ? "Revoke" : "Enable"}
                        </button>
                        <button onClick={() => deleteKey(k.id)} disabled={busy === k.id}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
