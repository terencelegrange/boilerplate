"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
}

export default function SitesConfigurationPage() {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEnv, setActiveEnv] = useState("dev");
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedSite, setSelectedSite] = useState<MonitoredSite | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [healthCheckUrl, setHealthCheckUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [siteToDelete, setSiteToDelete] = useState<MonitoredSite | null>(null);

  // Fetch active environment and check admin status
  useEffect(() => {
    const env = document.cookie.split("; ").find((c) => c.startsWith("omni_env="))?.split("=")[1] || "dev";
    setActiveEnv(env);

    fetch("/api/me/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.role === "admin") {
          setIsAdmin(true);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch sites
  async function loadSites() {
    setLoading(true);
    try {
      const r = await fetch(`/api/sites?env=${activeEnv}`);
      if (r.ok) {
        const d = await r.json();
        setSites(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites();
  }, [activeEnv]);

  // Open modal for add
  function handleOpenAdd() {
    setModalMode("add");
    setName("");
    setUrl("");
    setHealthCheckUrl("");
    setFormError("");
    setIsModalOpen(true);
  }

  // Open modal for edit
  function handleOpenEdit(site: MonitoredSite) {
    setModalMode("edit");
    setSelectedSite(site);
    setName(site.name);
    setUrl(site.url);
    setHealthCheckUrl(site.health_check_url);
    setFormError("");
    setIsModalOpen(true);
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!name.trim() || !url.trim() || !healthCheckUrl.trim()) {
      setFormError("All fields are required.");
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
      new URL(healthCheckUrl);
    } catch {
      setFormError("Please enter valid absolute URLs starting with http:// or https://");
      return;
    }

    setIsSubmitting(true);

    try {
      const method = modalMode === "add" ? "POST" : "PATCH";
      const endpoint = modalMode === "add" ? "/api/sites" : `/api/sites/${selectedSite?.id}`;
      const payload = {
        name,
        url,
        health_check_url: healthCheckUrl,
        environment: activeEnv
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        await loadSites();
      } else {
        const data = await res.json();
        setFormError(data.error || "An error occurred.");
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to save site.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle delete action
  async function handleDelete(siteId: number) {
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSiteToDelete(null);
        await loadSites();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div>
      {/* Breadcrumbs / Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Link href="/settings" className="hover:text-emerald-500 transition">Settings</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Sites</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Sites & Health Checks</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Configure and manage monitored sites in environment: <span className="font-bold text-emerald-500">{activeEnv.toUpperCase()}</span>
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm self-start"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Monitored Site
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          // Loading Skeleton
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5 flex items-center justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-gray-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-64 bg-gray-150 dark:bg-slate-850 rounded" />
                </div>
                <div className="h-8 w-20 bg-gray-200 dark:bg-slate-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : sites.length === 0 ? (
          // Empty State
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Sites Configured</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              There are no monitored sites set up for the current environment ({activeEnv.toUpperCase()}).
            </p>
          </div>
        ) : (
          // Table
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-150 dark:divide-slate-800 text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Site Name</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Base URL</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Health Endpoint</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Last Status</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-slate-850">
                {sites.map((site) => {
                  const isUp = site.status === "up";
                  const isDown = site.status === "down";
                  let statusBadge = "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 border-gray-200 dark:border-slate-700";
                  if (isUp) statusBadge = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
                  if (isDown) statusBadge = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";

                  return (
                    <tr key={site.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/20 transition">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{site.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <a href={site.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-mono truncate block max-w-[220px]">
                          {site.url}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-mono truncate block max-w-[220px]" title={site.health_check_url}>
                          {site.health_check_url}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${statusBadge}`}>
                          {site.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleOpenEdit(site)}
                              className="text-xs text-gray-500 hover:text-emerald-500 transition px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setSiteToDelete(site)}
                              className="text-xs text-red-500 hover:text-red-600 transition px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT / ADD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {modalMode === "add" ? "Add Monitored Site" : "Edit Site Configuration"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium border border-red-200/50 dark:border-red-950/50">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Site Name</label>
                <input
                  type="text"
                  placeholder="e.g. Payment Gateway"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3.5 py-2 border border-gray-250 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Base URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://api.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="block w-full px-3.5 py-2 border border-gray-250 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Health Check URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://api.example.com/healthz"
                  value={healthCheckUrl}
                  onChange={(e) => setHealthCheckUrl(e.target.value)}
                  className="block w-full px-3.5 py-2 border border-gray-250 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-955 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4.5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Site"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {siteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Delete Monitored Site?</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to stop monitoring <span className="font-bold text-gray-750 dark:text-slate-300">{siteToDelete.name}</span>? This will permanently delete all its logs and check histories.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setSiteToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-slate-800 text-gray-750 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(siteToDelete.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
