"use client";

import { useEffect, useState } from "react";
import { NAV_ITEMS, ROLES } from "@/data/nav";

/* ─── Types ─────────────────────────────────────────────── */
interface User { id: number; email: string; name: string | null; role: string; status: string; created_at: string; }
interface OverviewData {
  totalUsers: number;
  pendingUsers: number;
  auditEvents: number;
  newUsers: { id: number; email: string; name: string | null; status: string; created_at: string }[];
  recentAudit: { id: number; action: string; created_at: string; user_email: string | null }[];
}
interface AuditEntry { id: number; action: string; resource: string | null; resource_id: string | null; details: string | null; ip: string | null; created_at: string; user_email: string | null; user_name: string | null; }
interface FeatureFlag { key: string; enabled: boolean; label: string; description: string; }

/* ─── Badges ─────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    pending:  "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s[status] ?? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700"}`}>{status}</span>;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:                "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  LOGOUT:               "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700",
  LOGIN_FAILED:         "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  SIGNUP:               "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  USER_APPROVED:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  USER_REJECTED:        "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  USER_DELETED:         "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  USER_UPDATED:         "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  THEME_CHANGED:        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  FEATURE_FLAG_UPDATED: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};
function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${style}`}>{action}</span>;
}

/* ─── Users tab ─────────────────────────────────────────── */
function UsersTab() {
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
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-3">
          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <span className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">{pending.length} user{pending.length !== 1 ? "s" : ""} waiting for approval</span>
        </div>
      )}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(["pending", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filter === f ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"}`}>
            {f === "pending" ? `Pending (${pending.length})` : "All Users"}
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-800">
              {["User","Role","Status","Joined",""].map((h) => (
                <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider ${h ? "text-left" : "text-right"}`}>{h || "Actions"}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? Array.from({length:3}).map((_,i)=>(
              <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse"/></td></tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-gray-500 dark:text-slate-400">{filter==="pending"?"No pending approvals.":"No users found."}</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{(u.name??u.email)[0].toUpperCase()}</span>
                    </div>
                    <div><p className="font-medium text-gray-900 dark:text-white">{u.name??"—"}</p><p className="text-xs text-gray-500 dark:text-slate-400">{u.email}</p></div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <select value={u.role} disabled={busy===u.id} onChange={(e)=>update(u.id,{role:e.target.value})}
                    className="bg-transparent border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-5 py-3"><StatusBadge status={u.status}/></td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {u.status==="pending"&&<><button onClick={()=>update(u.id,{status:"approved"})} disabled={busy===u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-50">Approve</button><button onClick={()=>update(u.id,{status:"rejected"})} disabled={busy===u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50">Reject</button></>}
                    {u.status==="approved"&&<button onClick={()=>update(u.id,{status:"rejected"})} disabled={busy===u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition disabled:opacity-50">Revoke</button>}
                    {u.status==="rejected"&&<button onClick={()=>update(u.id,{status:"approved"})} disabled={busy===u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-50">Re-approve</button>}
                    <button onClick={()=>del(u.id)} disabled={busy===u.id} className="px-2.5 py-1 text-xs font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Audit tab ─────────────────────────────────────────── */
const AUDIT_ACTIONS = ["","LOGIN","LOGOUT","LOGIN_FAILED","SIGNUP","USER_APPROVED","USER_REJECTED","USER_DELETED","USER_UPDATED","THEME_CHANGED","FEATURE_FLAG_UPDATED"];

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filter) p.set("action", filter);
    fetch(`/api/audit?${p}`).then((r)=>r.json()).then((d)=>{ setEntries(d.entries??[]); setTotal(d.total??0); setLoading(false); }).catch(()=>setLoading(false));
  }, [page, filter]);

  const pages = Math.ceil(total / limit);
  const visible = search.trim() ? entries.filter((e)=>[e.action,e.user_email,e.user_name,e.resource,e.details,e.ip].some((v)=>v?.toLowerCase().includes(search.toLowerCase()))) : entries;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="Search user, action, IP…" value={search} onChange={(e)=>setSearch(e.target.value)} className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"/>
        </div>
        <div className="h-4 w-px bg-gray-200 dark:bg-slate-700"/>
        <select value={filter} onChange={(e)=>{ setFilter(e.target.value); setPage(1); }} className="bg-transparent border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          {AUDIT_ACTIONS.map((a)=><option key={a} value={a}>{a||"All actions"}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">{total} total events</span>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-800">
              {["Time","Action","User","Resource","Details","IP"].map((h)=>(
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? Array.from({length:5}).map((_,i)=>(
              <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse"/></td></tr>
            )) : visible.length===0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-slate-400">No events found.</td></tr>
            ) : visible.map((e)=>(
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-5 py-3"><ActionBadge action={e.action}/></td>
                <td className="px-5 py-3 text-xs text-gray-700 dark:text-slate-300">{e.user_name??e.user_email??<span className="italic text-gray-400 dark:text-slate-500">system</span>}</td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400">{e.resource?`${e.resource}${e.resource_id?` #${e.resource_id}`:""}` :"—"}</td>
                <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-xs truncate">{e.details?<span title={e.details}>{e.details.length>60?e.details.slice(0,60)+"…":e.details}</span>:"—"}</td>
                <td className="px-5 py-3 text-xs text-gray-400 dark:text-slate-500">{e.ip??"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages>1&&(
        <div className="flex items-center justify-between">
          <button onClick={()=>setPage((p)=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 transition">Previous</button>
          <span className="text-xs text-gray-500 dark:text-slate-400">Page {page} of {pages}</span>
          <button onClick={()=>setPage((p)=>Math.min(pages,p+1))} disabled={page===pages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 transition">Next</button>
        </div>
      )}
    </div>
  );
}

/* ─── Feature Flags tab ─────────────────────────────────── */
function FeatureFlagsTab() {
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
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Toggle application features on or off. Changes take effect immediately.
      </p>
      <div className="grid grid-cols-1 gap-3">
        {loading ? Array.from({length:3}).map((_,i)=>(
          <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-2"/>
            <div className="h-3 w-64 bg-gray-100 dark:bg-slate-800 rounded"/>
          </div>
        )) : flags.map((f) => (
          <div key={f.key} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.label}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{f.description}</p>
              <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-1">{f.key}</p>
            </div>
            <button
              onClick={() => toggle(f.key, f.enabled)}
              disabled={busy === f.key}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${f.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-600"}`}
              role="switch"
              aria-checked={f.enabled}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${f.enabled ? "translate-x-5" : "translate-x-0"}`}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Documentation tab ─────────────────────────────────── */
const METHOD_COLORS: Record<string, string> = {
  get:    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  post:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  patch:  "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  put:    "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

function DocsTab() {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/openapi").then((r)=>r.json()).then((d)=>{ setSpec(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {Array.from({length:4}).map((_,i)=>(
        <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 animate-pulse">
          <div className="h-4 w-48 bg-gray-200 dark:bg-slate-700 rounded"/>
        </div>
      ))}
    </div>
  );

  if (!spec) return <p className="text-sm text-gray-500 dark:text-slate-400">Failed to load spec.</p>;

  // Group paths by tag
  const paths = spec.paths as Record<string, Record<string, { tags?: string[]; summary?: string; description?: string; parameters?: unknown[]; requestBody?: unknown; responses?: Record<string, { description: string }> }>>;
  const grouped: Record<string, { method: string; path: string; op: { tags?: string[]; summary?: string; description?: string; parameters?: unknown[]; requestBody?: unknown; responses?: Record<string, { description: string }> } }[]> = {};

  for (const [path, methods] of Object.entries(paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push({ method, path, op });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{(spec.info as {title:string}).title} <span className="text-xs font-normal text-gray-400">v{(spec.info as {version:string}).version}</span></p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{(spec.info as {description:string}).description}</p>
        </div>
        <a href="/api/openapi" target="_blank" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">View raw JSON ↗</a>
      </div>
      {Object.entries(grouped).map(([tag, endpoints]) => (
        <div key={tag} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">{tag}</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {endpoints.map(({ method, path, op }) => {
              const id = `${method}:${path}`;
              const isOpen = expanded === id;
              return (
                <div key={id}>
                  <button onClick={() => setExpanded(isOpen ? null : id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition text-left">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border uppercase ${METHOD_COLORS[method] ?? "bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"}`}>{method}</span>
                    <code className="text-xs text-gray-700 dark:text-slate-300 font-mono">/api{path}</code>
                    <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">{op.summary}</span>
                    <svg className={`w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0 transition-transform ${isOpen?"rotate-180":""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 space-y-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                      {op.description && <p className="text-xs text-gray-600 dark:text-slate-400 pt-3">{op.description}</p>}
                      {op.responses && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Responses</p>
                          <div className="space-y-1">
                            {Object.entries(op.responses).map(([code, res]) => (
                              <div key={code} className="flex items-center gap-2">
                                <span className={`text-xs font-mono font-bold ${code.startsWith("2") ? "text-emerald-600 dark:text-emerald-400" : code.startsWith("4") || code.startsWith("5") ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-slate-400"}`}>{code}</span>
                                <span className="text-xs text-gray-500 dark:text-slate-400">{res.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Roles tab ─────────────────────────────────────────── */
function RolesTab() {
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

  if (loading) return <div className="h-32 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Configure which navigation items each role can access. Changes take effect on next login or page refresh.
      </p>
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
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{item.href}</p>
                  </div>
                </td>
                {ROLES.map((r) => {
                  const checked = (permissions[r.key] ?? []).includes(item.key);
                  const isAdminSettings = r.key === "admin"; // admin always gets everything by convention
                  return (
                    <td key={r.key} className="px-5 py-3 text-center">
                      <button
                        onClick={() => toggle(r.key, item.key)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition ${
                          checked
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-gray-300 dark:border-slate-600 hover:border-emerald-400"
                        }`}
                      >
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
          {saving ? "Saving…" : "Save permissions"}
        </button>
      </div>
    </div>
  );
}

/* ─── Overview tiles ─────────────────────────────────────── */
const ACTION_SHORT: Record<string, string> = {
  LOGIN: "Logged in", LOGOUT: "Logged out", LOGIN_FAILED: "Login failed",
  SIGNUP: "Signed up", USER_APPROVED: "User approved", USER_REJECTED: "User rejected",
  USER_DELETED: "User deleted", USER_UPDATED: "User updated", THEME_CHANGED: "Theme changed",
  FEATURE_FLAG_UPDATED: "Flag toggled", RBAC_UPDATED: "Roles updated",
};

function OverviewTiles() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/overview").then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Total users tile */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">All Users</h3>
          {!loading && <span className="text-xl font-bold text-gray-900 dark:text-white">{data?.totalUsers ?? 0}</span>}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-2.5 animate-pulse flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
                <div className="flex-1 space-y-1"><div className="h-3 w-32 bg-gray-200 dark:bg-slate-700 rounded" /><div className="h-2.5 w-20 bg-gray-100 dark:bg-slate-800 rounded" /></div>
              </div>
            ))
          ) : (data?.newUsers ?? []).filter((u) => u.status === "approved" || u.status === "pending" || u.status === "rejected").slice(0, 5).map((u) => (
            <div key={u.id} className="px-5 py-2.5 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{(u.name ?? u.email)[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{u.name ?? u.email}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
              </div>
              <StatusBadge status={u.status} />
            </div>
          ))}
        </div>
      </div>

      {/* New registrations tile */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">New Registrations</h3>
          {!loading && (
            <span className={`text-xl font-bold ${(data?.pendingUsers ?? 0) > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}>
              {data?.pendingUsers ?? 0}
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="px-5 py-2.5 animate-pulse flex gap-2">
                <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-800 rounded" />
              </div>
            ))
          ) : (data?.newUsers ?? []).filter((u) => u.status === "pending").length === 0 ? (
            <p className="px-5 py-3 text-xs text-gray-400 dark:text-slate-500 italic">No pending registrations</p>
          ) : (data?.newUsers ?? []).filter((u) => u.status === "pending").map((u) => (
            <div key={u.id} className="px-5 py-2.5 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">{(u.name ?? u.email)[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{u.name ?? u.email}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(u.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent audit tile */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Recent Activity</h3>
          {!loading && <span className="text-xl font-bold text-gray-900 dark:text-white">{data?.auditEvents ?? 0}</span>}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-2.5 animate-pulse flex gap-2">
                <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-800 rounded" />
              </div>
            ))
          ) : (data?.recentAudit ?? []).map((e) => (
            <div key={e.id} className="px-5 py-2.5 flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white">{ACTION_SHORT[e.action] ?? e.action}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{e.user_email ?? "system"}</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── API Access tab ────────────────────────────────────── */
interface ApiKey {
  id: number; prefix: string; name: string; contact: string;
  expires_at: string | null; created_at: string; last_used: string | null;
  active: boolean; created_by_email: string | null;
}

function ApiAccessTab() {
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-slate-400">API keys grant full access to all endpoints via <code className="text-xs bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> header.</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15"/></svg>
          New Key
        </button>
      </div>

      {/* New key revealed — shown once */}
      {created && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Key created — copy it now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 font-mono text-gray-800 dark:text-slate-200 break-all">{created.key}</code>
            <button onClick={() => { navigator.clipboard.writeText(created.key); }}
              className="px-3 py-2 text-xs rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition flex-shrink-0">Copy</button>
          </div>
          <button onClick={() => setCreated(null)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Generate new API key</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Name / Label</label>
              <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Mobile App"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Contact</label>
              <input required value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="email or name"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">Expires <span className="text-gray-400">(leave blank for indefinite)</span></label>
              <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"/>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition">Cancel</button>
            <button type="submit" disabled={creating}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">{creating ? "Generating…" : "Generate key"}</button>
          </div>
        </form>
      )}

      {/* Keys table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-800">
              {["Key","Name","Contact","Expires","Last Used","Status",""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? Array.from({length:2}).map((_,i)=>(
              <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse"/></td></tr>
            )) : keys.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">No API keys yet.</td></tr>
            ) : keys.map((k) => {
              const expired = k.expires_at ? new Date(k.expires_at) < new Date() : false;
              return (
                <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3"><code className="text-xs font-mono text-gray-600 dark:text-slate-300">{k.prefix}…</code></td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{k.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">{k.contact}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {k.expires_at ? (
                      <span className={expired ? "text-red-500" : ""}>{new Date(k.expires_at).toLocaleDateString()}{expired ? " (expired)" : ""}</span>
                    ) : <span className="italic text-gray-400 dark:text-slate-500">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">{k.last_used ? new Date(k.last_used).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${k.active && !expired ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"}`}>
                      {k.active && !expired ? "Active" : expired ? "Expired" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleActive(k.id, k.active)} disabled={busy===k.id || expired}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition disabled:opacity-50">
                        {k.active ? "Revoke" : "Enable"}
                      </button>
                      <button onClick={() => deleteKey(k.id)} disabled={busy===k.id}
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
  );
}

/* ─── Changelog tab ─────────────────────────────────────── */
function ChangelogTab() {
  const [entries, setEntries] = useState<{ id: number; date: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((d) => { setEntries(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group by date
  const grouped = entries.reduce<Record<string, string[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e.description);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Development changes and feature releases, most recent first.
      </p>
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

/* ─── Page ──────────────────────────────────────────────── */
type Tab = "users" | "audit" | "roles" | "flags" | "apikeys" | "docs" | "changelog";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("users");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "users",     label: "Users",         icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg> },
    { id: "audit",     label: "Audit Log",     icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg> },
    { id: "roles",     label: "Roles",         icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg> },
    { id: "flags",     label: "Feature Flags", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"/></svg> },
    { id: "apikeys",   label: "API Access",    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg> },
    { id: "docs",      label: "Documentation", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg> },
    { id: "changelog", label: "Changelog",     icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Manage users, roles, feature flags, and system configuration</p>
      </div>

      {/* Overview tiles — always visible */}
      <OverviewTiles />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab===t.id ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === "users"     && <UsersTab />}
      {tab === "audit"     && <AuditTab />}
      {tab === "roles"     && <RolesTab />}
      {tab === "flags"     && <FeatureFlagsTab />}
      {tab === "apikeys"   && <ApiAccessTab />}
      {tab === "docs"      && <DocsTab />}
      {tab === "changelog" && <ChangelogTab />}
    </div>
  );
}
