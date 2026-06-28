"use client";

import { useEffect, useState } from "react";

const METHOD_COLORS: Record<string, string> = {
  get:    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  post:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  patch:  "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  put:    "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export default function DocumentationPage() {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/openapi").then((r) => r.json()).then((d) => { setSpec(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documentation</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Live OpenAPI spec and endpoint reference</p>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 animate-pulse">
            <div className="h-4 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );

  if (!spec) return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documentation</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400">Failed to load spec.</p>
    </div>
  );

  const paths = spec.paths as Record<string, Record<string, { tags?: string[]; summary?: string; description?: string; parameters?: unknown[]; requestBody?: unknown; responses?: Record<string, { description: string }> }>>;
  const grouped: Record<string, { method: string; path: string; op: { tags?: string[]; summary?: string; description?: string; responses?: Record<string, { description: string }> } }[]> = {};

  for (const [path, methods] of Object.entries(paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push({ method, path, op });
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documentation</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Live OpenAPI spec and endpoint reference</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {(spec.info as { title: string }).title}{" "}
              <span className="text-xs font-normal text-gray-400">v{(spec.info as { version: string }).version}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{(spec.info as { description: string }).description}</p>
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
                      <svg className={`w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
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
    </div>
  );
}
