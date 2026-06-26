# Error Handling — Design Spec

## Overview

Add resilient, user-friendly error handling across the boilerplate app. Covers catastrophic render failures, DB unavailability, server downtime, browser offline state, 404 routes, and slow/hanging requests.

**Goal:** Users see a clear, friendly message for every failure condition instead of an infinite spinner, blank screen, or raw JSON error.

---

## Architecture

Four layers of error handling, each targeting a different failure mode:

1. **Error pages** — Next.js App Router `error.tsx` and `not-found.tsx` files that catch render-time failures
2. **Offline banner** — Client-side `online`/`offline` event listener in the dashboard layout
3. **`apiFetch` utility** — Thin wrapper around `fetch` for consistent client-side error classification
4. **API route hardening** — Ensure all route handlers return JSON errors (not HTML 500 pages) when the DB is unavailable

---

## Tech Stack

Next.js 15 App Router · TypeScript · Tailwind CSS v3 (`darkMode: "class"`) · Prisma raw SQL · MySQL

---

## Global Constraints

- No new npm packages
- All dark-mode styles use `dark:` Tailwind prefix
- Error messages must be user-friendly — no stack traces, SQL errors, or internal identifiers shown to the user
- All API routes must return `Content-Type: application/json` even on errors — never raw Next.js HTML 500
- Port 3333

---

## Feature 1: Error Pages

### 1.1 Root global error — `src/app/error.tsx`

Catches: hydration mismatches, server component crashes, unhandled exceptions that bubble up to the root.

```tsx
"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) { ... }
```

Content:
- Large warning icon (amber)
- Heading: "Something went wrong"
- Subtext: "An unexpected error occurred. This has been noted."
- "Try again" button → calls `reset()`
- "Go to login" link → `/login`

Styling: full-screen centred card, `bg-gray-50 dark:bg-slate-950`, consistent with existing app styles.

### 1.2 Dashboard error — `src/app/(dashboard)/error.tsx`

Same `"use client"` constraint. Catches errors within the `(dashboard)` route group.

Content:
- Warning icon (amber)
- Heading: "Something went wrong"
- Subtext: "An unexpected error occurred in this section."
- "Try again" button → calls `reset()`
- "Back to dashboard" link → `/`

### 1.3 Not found — `src/app/not-found.tsx`

Catches all 404 routes.

Content:
- Large "404" in muted text
- Heading: "Page not found"
- Subtext: "This page doesn't exist or has been moved."
- "Go to dashboard" button → `/`

---

## Feature 2: Offline Banner

### Location

`src/app/(dashboard)/layout.tsx` — a banner rendered conditionally above the main content area (below the top bar, above `{children}`).

### Implementation

New state + effect in `DashboardLayout`:

```ts
const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  setIsOnline(navigator.onLine);
  const handleOnline  = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  window.addEventListener("online",  handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online",  handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);
```

### Banner markup

Rendered inside `<main>`, above `<div className="max-w-6xl mx-auto px-6 py-8">`:

```tsx
{!isOnline && (
  <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2.5">
    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
    <p className="text-sm text-amber-700 dark:text-amber-300">
      You&apos;re offline — some features may be unavailable.
    </p>
  </div>
)}
```

The banner auto-dismisses when connectivity is restored (state-driven, no manual dismiss needed).

---

## Feature 3: `apiFetch` Utility

### File: `src/lib/apiFetch.ts`

A thin wrapper around the native `fetch` API. All client-side data fetches in settings sub-pages and the dashboard use this instead of raw `fetch`.

### Error class

```ts
export class ApiError extends Error {
  constructor(
    public readonly code: "SERVER_DOWN" | "SERVER_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "UNAUTHORIZED",
    public readonly status?: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}
```

### Wrapper

```ts
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError("SERVER_DOWN", undefined, "Unable to reach the server");
  }

  if (response.status === 401) throw new ApiError("UNAUTHORIZED", 401);
  if (response.status === 403) throw new ApiError("FORBIDDEN", 403);
  if (response.status === 404) throw new ApiError("NOT_FOUND", 404);
  if (response.status === 503) throw new ApiError("SERVER_ERROR", 503, "Database unavailable");
  if (!response.ok)            throw new ApiError("SERVER_ERROR", response.status);

  return response.json() as Promise<T>;
}
```

On `UNAUTHORIZED`: caller should redirect to `/login` (or the utility can do it if `typeof window !== "undefined"`). Decision: the utility throws; callers handle redirect.

### Usage pattern in components

```ts
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  apiFetch<User[]>("/api/users")
    .then(setUsers)
    .catch((e: ApiError) => {
      if (e.code === "UNAUTHORIZED") router.push("/login");
      else setError(friendlyMessage(e.code));
    });
}, []);
```

### `friendlyMessage` helper (in same file)

```ts
export function friendlyMessage(code: ApiError["code"]): string {
  switch (code) {
    case "SERVER_DOWN":  return "Unable to reach the server. Please check your connection.";
    case "SERVER_ERROR": return "A server error occurred. Please try again in a moment.";
    case "FORBIDDEN":    return "You don't have permission to view this.";
    case "NOT_FOUND":    return "The requested resource was not found.";
    case "UNAUTHORIZED": return "Your session has expired. Please log in again.";
  }
}
```

### Scope of adoption

`apiFetch` is used in:
- All settings sub-pages (new files in Plan A)
- Dashboard page (`src/app/(dashboard)/page.tsx`)
- Existing layout fetches for feature flags and RBAC (already have `catch(() => {})` — keep as-is; these fail open by design)

**Not** applied to: the existing `layout.tsx` feature-flags and RBAC fetches, which intentionally fail open and already have catch blocks.

---

## Feature 4: `ApiErrorMessage` Component

### File: `src/components/ApiErrorMessage.tsx`

Reusable inline error card used by all settings sub-pages and the dashboard when `apiFetch` throws.

```tsx
export function ApiErrorMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
        {onRetry && (
          <button onClick={onRetry}
            className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Feature 5: API Route Hardening

### Problem

When MySQL is unavailable, Prisma throws. Currently:
- If the error is caught in a route: returns 500 with whatever message Prisma gives
- If uncaught: Next.js renders an HTML 500 page — not JSON

Clients that call these routes and try to `response.json()` will crash silently.

### Fix

Wrap every route handler body in a top-level try/catch that returns JSON:

**Pattern for all route files under `src/app/api/`:**

```ts
export async function GET(req: NextRequest) {
  try {
    // ... existing logic
  } catch (e) {
    console.error("[api/route-name] error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
```

**DB-specific detection:** if the caught error's message includes `"ECONNREFUSED"`, `"connect ETIMEDOUT"`, or `"Can't connect to MySQL"`, return status **503** (not 500) so `apiFetch` can distinguish "DB down" from "bug":

```ts
} catch (e) {
  const msg = e instanceof Error ? e.message : "";
  const isDbDown = /ECONNREFUSED|ETIMEDOUT|Can't connect to MySQL/i.test(msg);
  console.error("[api/route-name] error:", e);
  return NextResponse.json(
    { error: isDbDown ? "Database unavailable" : "An unexpected error occurred" },
    { status: isDbDown ? 503 : 500 }
  );
}
```

**Files to update:** all route files under `src/app/api/` — wrap each `GET`, `POST`, `PATCH`, `DELETE` export.

### `initDb` failure

`initDb()` is called from multiple routes. If it throws (DB unavailable), the current route handler will fail unhandled. Fix: each route that calls `initDb()` is covered by the top-level try/catch above — no separate change needed.

---

## Feature 6: Health Check Endpoint

### File: `src/app/api/health/route.ts`

Public route — no auth required. Add to `publicPaths` in `src/middleware.ts`.

```ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: false, ts: new Date().toISOString() }, { status: 503 });
  }
}
```

### Login page usage

`src/app/login/page.tsx` — on mount, call `GET /api/health`. If `ok === false`, show an amber banner above the login form:

```
⚠ System is currently unavailable — please try again later.
```

The form remains visible (user can still try to log in — the health check is advisory, not a gate).

---

## Feature 7: Slow Request Warning

### Scope

Applied in settings sub-pages and the dashboard (components that use `apiFetch`).

### Pattern

Each component that fetches data on mount adds a timeout warning:

```ts
const [slow, setSlow] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => setSlow(true), 5000);
  apiFetch(...)
    .then(...)
    .catch(...)
    .finally(() => clearTimeout(timer));
  return () => clearTimeout(timer);
}, []);
```

When `slow && loading`:

```tsx
{slow && loading && (
  <p className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
    Taking longer than expected…
  </p>
)}
```

---

## Out of Scope

- Error reporting / Sentry integration — deferred
- Retry logic with exponential backoff — deferred
- Toast notification system (Sonner/react-hot-toast) — deferred; `ApiErrorMessage` handles inline errors
- Server-side circuit breaker / DB connection pooling config — infrastructure concern, not app concern
- Automatic session refresh on 401 — deferred (current middleware redirect is sufficient)
