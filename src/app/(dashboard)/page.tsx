"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  auditCount: number;
  recentUsers: { id: number; email: string; name: string | null; status: string; created_at: string }[];
}

function StatTile({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-2.5 text-3xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    pending:  "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[status] ?? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [overviewData, setOverviewData] = useState<DashboardData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      setOverviewLoading(true);
      try {
        const r = await fetch("/api/dashboard");
        if (r.ok) {
          const d = await r.json();
          setOverviewData(d);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setOverviewLoading(false);
      }
    }
    fetchOverview();
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Overall platform administration</p>
      </div>

      <div className="space-y-8">
        {/* Stat tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse space-y-3">
                <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            ))
          ) : (
            <>
              <StatTile label="Total Users"    value={overviewData?.totalUsers    ?? 0} color="text-gray-900 dark:text-white" />
              <StatTile label="Approved"       value={overviewData?.approvedUsers ?? 0} color="text-emerald-600 dark:text-emerald-400" />
              <StatTile label="Pending"        value={overviewData?.pendingUsers  ?? 0} color="text-yellow-600 dark:text-yellow-400" />
              <StatTile label="Audit Events"   value={overviewData?.auditCount    ?? 0} color="text-blue-600 dark:text-blue-400" />
            </>
          )}
        </div>

        {/* Grid of placeholders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: "Analytics",    desc: "View usage trends and statistics." },
            { title: "Reports",      desc: "Generate and export reports." },
            { title: "Integrations", desc: "Connect third-party services." },
            { title: "Notifications",desc: "Manage alerts and notifications." },
            { title: "Billing",      desc: "View plans and invoices." },
            { title: "API Keys",     desc: "Manage programmatic access." },
          ].map((tile) => (
            <div key={tile.title} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-2 hover:border-emerald-500/40 transition cursor-default">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tile.title}</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">{tile.desc}</p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-slate-855 overflow-hidden">
                <div className="h-full w-0 bg-emerald-500/40 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Recent registrations */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4.5 border-b border-gray-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Recent Registrations</h2>
          </div>
          <div className="divide-y divide-gray-150 dark:divide-slate-800">
            {overviewLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
                    <div className="h-2.5 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))
            ) : overviewData?.recentUsers.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500 dark:text-slate-400">No users yet.</p>
            ) : (
              overviewData?.recentUsers.map((u) => (
                <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {(u.name ?? u.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{u.name ?? u.email}</p>
                    {u.name && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{u.email}</p>}
                  </div>
                  <StatusBadge status={u.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
