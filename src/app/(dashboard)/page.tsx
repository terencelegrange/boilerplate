"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  auditCount: number;
  recentUsers: { id: number; email: string; name: string | null; status: string; created_at: string }[];
}

interface HealthCheckLog {
  id: number;
  status: string;
  status_code: number | null;
  latency: number | null;
  error: string | null;
  created_at: string;
}

interface MonitoredSite {
  id: number;
  name: string;
  url: string;
  health_check_url: string;
  environment: string;
  status: string;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
  recentLogs: HealthCheckLog[];
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
  const [activeTab, setActiveTab] = useState<"health" | "overview">("health");
  const [activeEnv, setActiveEnv] = useState("dev");

  // Overview data
  const [overviewData, setOverviewData] = useState<DashboardData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Health checks data
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [refreshingSiteId, setRefreshingSiteId] = useState<number | null>(null);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Get active env on mount
  useEffect(() => {
    const env = document.cookie.split("; ").find((c) => c.startsWith("omni_env="))?.split("=")[1] || "dev";
    setActiveEnv(env);
  }, []);

  // Fetch overview data
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

  // Fetch health checks data
  async function fetchHealth() {
    setHealthLoading(true);
    try {
      const r = await fetch(`/api/health-checks?env=${activeEnv}`);
      if (r.ok) {
        const d = await r.json();
        setSites(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHealthLoading(false);
    }
  }

  // Load appropriate data on tab change or env change
  useEffect(() => {
    if (activeTab === "health") {
      fetchHealth();
    } else {
      fetchOverview();
    }
  }, [activeTab, activeEnv]);

  // Run single health check
  async function handleCheckSingle(siteId: number) {
    setRefreshingSiteId(siteId);
    try {
      await fetch("/api/health-checks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId })
      });
      // Reload sites to get new status
      await fetchHealth();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingSiteId(null);
    }
  }

  // Refresh all sites in environment
  async function handleRefreshAll() {
    setGlobalRefreshing(true);
    try {
      await fetch(`/api/health-checks/run?env=${activeEnv}`, {
        method: "POST"
      });
      await fetchHealth();
    } catch (e) {
      console.error(e);
    } finally {
      setGlobalRefreshing(false);
    }
  }

  // Format relative time (e.g., 2m ago)
  function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  }

  // Filter sites by search query
  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.health_check_url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {activeTab === "health"
              ? `Real-time application monitoring for environment: ${activeEnv.toUpperCase()}`
              : `Overall platform administration for ${activeEnv.toUpperCase()}`}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-gray-100 dark:bg-slate-900/60 p-1 rounded-xl self-start border border-gray-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("health")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wide transition ${
              activeTab === "health"
                ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700/50"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Health Checks
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-wide transition ${
              activeTab === "overview"
                ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-slate-700/50"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            System Overview
          </button>
        </div>
      </div>

      {/* TABS CONTAINER */}
      {activeTab === "health" ? (
        // HEALTH CHECKS TAB
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-sm placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshAll}
                disabled={globalRefreshing || healthLoading}
                className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${globalRefreshing ? "animate-spin text-emerald-500" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H17.647" />
                </svg>
                {globalRefreshing ? "Checking..." : "Refresh All"}
              </button>
              <Link
                href="/settings/sites"
                className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Configure Sites
              </Link>
            </div>
          </div>

          {healthLoading && sites.length === 0 ? (
            // Skeleton state
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-gray-250 dark:bg-slate-850 rounded" />
                    <div className="h-5 w-12 bg-gray-250 dark:bg-slate-850 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-48 bg-gray-200 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-64 bg-gray-200 dark:bg-slate-800 rounded" />
                  </div>
                  <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredSites.length === 0 ? (
            // Empty state
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.07 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Monitored Sites</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? "No sites matched your search query. Try typing something else or clear the filter."
                  : `There are no sites configured for the ${activeEnv.toUpperCase()} environment. Add your first site to start monitoring.`}
              </p>
              {!searchQuery && (
                <Link
                  href="/settings/sites"
                  className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white mt-6 transition shadow-sm"
                >
                  Configure New Site
                </Link>
              )}
            </div>
          ) : (
            // Cards Grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSites.map((site) => {
                const isSiteRefreshing = refreshingSiteId === site.id;
                const isHealthy = site.status === "up";
                const isUnhealthy = site.status === "down";

                // Map status badges
                let badgeClass = "bg-gray-150 text-gray-600 dark:bg-slate-800 dark:text-slate-400 border-gray-250 dark:border-slate-700";
                let badgeText = "Unknown";
                let pulseClass = "";

                if (isHealthy) {
                  badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
                  badgeText = "Healthy";
                  pulseClass = "bg-emerald-500 animate-ping";
                } else if (isUnhealthy) {
                  badgeClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
                  badgeText = "Down";
                  pulseClass = "bg-red-500 animate-ping";
                }

                return (
                  <div
                    key={site.id}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-5 shadow-sm hover:shadow-md transition"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate" title={site.name}>
                          {site.name}
                        </h3>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-400 hover:text-emerald-500 transition mt-0.5 inline-block truncate max-w-full"
                        >
                          {site.url.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                      
                      <div className="flex items-center gap-1.5 border border-transparent">
                        {pulseClass && (
                          <span className="relative flex h-2 w-2">
                            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseClass}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? "bg-emerald-500" : "bg-red-500"}`}></span>
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                    </div>

                    {/* Middle Info */}
                    <div className="bg-gray-50 dark:bg-slate-950/50 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">Endpoint:</span>
                        <span className="font-mono text-gray-700 dark:text-slate-300 truncate max-w-[160px]" title={site.health_check_url}>
                          {site.health_check_url.substring(site.health_check_url.indexOf("/", 8))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">Response Time:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {site.recentLogs.length > 0 && site.recentLogs[site.recentLogs.length - 1].latency !== null
                            ? `${site.recentLogs[site.recentLogs.length - 1].latency} ms`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">Last Checked:</span>
                        <span className="text-gray-700 dark:text-slate-300">
                          {formatRelativeTime(site.last_checked)}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Sparkline & Trigger */}
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-3">
                      {/* Sparkline dots */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 mr-1 uppercase font-semibold">History:</span>
                        {Array.from({ length: 5 }).map((_, idx) => {
                          // recentLogs is chronological (ordered 0 = oldest, 4 = newest)
                          // We pad logs if length < 5 to keep circles filled right-aligned
                          const padCount = 5 - site.recentLogs.length;
                          if (idx < padCount) {
                            return (
                              <div
                                key={idx}
                                className="w-2.5 h-2.5 rounded-full border border-gray-250 dark:border-slate-800 bg-gray-100 dark:bg-slate-900/60"
                                title="No data"
                              />
                            );
                          }
                          const log = site.recentLogs[idx - padCount];
                          const ok = log.status === "up";
                          return (
                            <div
                              key={idx}
                              className={`w-2.5 h-2.5 rounded-full border ${
                                ok
                                  ? "bg-emerald-500 border-emerald-500/20 shadow-sm"
                                  : "bg-red-500 border-red-500/20 shadow-sm"
                              }`}
                              title={`${ok ? "Healthy" : `Error: ${log.error || "HTTP " + log.status_code}`} (${new Date(log.created_at).toLocaleTimeString()})`}
                            />
                          );
                        })}
                      </div>

                      {/* Manual trigger button */}
                      <button
                        onClick={() => handleCheckSingle(site.id)}
                        disabled={isSiteRefreshing || globalRefreshing}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                        title="Check health now"
                      >
                        <svg className={`w-4 h-4 ${isSiteRefreshing ? "animate-spin text-emerald-500" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H17.647" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // SYSTEM OVERVIEW TAB (Original boilerplate view)
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
      )}
    </div>
  );
}
