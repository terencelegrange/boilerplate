"use client";

import { useEffect, useState } from "react";

export default function CrisisBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crisis-banner")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { active: boolean; message: string } | null) => {
        if (data?.active && data.message.trim()) setMessage(data.message);
      })
      .catch(() => {});
  }, []);

  if (!message) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2.5 text-sm font-medium text-center flex items-center justify-center gap-2">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
