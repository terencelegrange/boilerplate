# Settings Hub, Notifications Bell & Feedback System — Design Spec

## Overview

Three interconnected features that reshape the settings section and add user-facing feedback tooling.

**Goal:** Convert the monolithic tabbed settings page into a navigable tile hub (following the pixel app pattern), add a non-functional notifications bell to the top bar, and build a full feedback system — floating bubble, emoji rating, screenshot capture, and an admin viewer in settings.

---

## Architecture

**Settings hub** — the 850-line `settings/page.tsx` is split: the tile grid index page stays lean; each section moves to its own sub-page file. Shared badge/colour helpers are extracted to a shared component so sub-pages don't duplicate them.

**Notifications** — purely UI, no data wiring. One button added to the top-bar layout.

**Feedback** — new DB table, two API routes, one floating UI component mounted in the dashboard layout, and one admin-only settings sub-page. `html-to-image` added as a dependency for screen capture.

---

## Tech Stack

Next.js 15 App Router · TypeScript · Tailwind CSS v3 (`darkMode: "class"`) · Prisma raw SQL · MySQL · `html-to-image` (new dependency, screen capture only)

---

## Global Constraints

- Raw SQL via `prisma.$executeRaw` / `$queryRaw` / `$executeRawUnsafe` — no Prisma model calls
- No new npm packages except `html-to-image` (for screenshot capture)
- All dark-mode styles use `dark:` Tailwind prefix; no inline `style=` attributes
- Cookie names: `bp_token`, `bp_theme`
- Auth: `getSession()` from `@/lib/auth`; `session.sub` is user ID string; `session.role` is `"admin"` | `"editor"` | `"viewer"`
- Audit every DB write with `auditLog()` from `@/lib/audit`
- Add every new API route to `src/app/api/openapi/route.ts`
- Add changelog entry to `src/data/changelog.ts` on completion
- Port 3333

---

## Feature 1: Settings Tile Hub

### Current state

`src/app/(dashboard)/settings/page.tsx` — 850 lines, single file. Contains seven tab components (`UsersTab`, `AuditTab`, `RolesTab`, `FeatureFlagsTab`, `ApiAccessTab`, `DocsTab`, `ChangelogTab`), shared badge helpers, and the `OverviewTiles` component. All rendered via a tab switcher.

### Target state

#### File layout after change

```
src/app/(dashboard)/settings/
  page.tsx              ← tile hub (replaces tab switcher; keeps OverviewTiles)
  users/page.tsx        ← UsersTab content
  roles/page.tsx        ← RolesTab content
  api-keys/page.tsx     ← ApiAccessTab content
  audit/page.tsx        ← AuditTab content
  changelog/page.tsx    ← ChangelogTab content
  flags/page.tsx        ← FeatureFlagsTab content
  docs/page.tsx         ← DocsTab content
  feedback/page.tsx     ← FeedbackTab (new, admin-only)

src/components/settings/
  shared.tsx            ← StatusBadge, ActionBadge, ACTION_COLORS, ACTION_SHORT
```

#### Hub page (`settings/page.tsx`)

Renders `OverviewTiles` at the top (unchanged), then a tile grid in two groups:

**Access & Users**
| Tile | Route | Icon colour |
|------|-------|-------------|
| Users | `/settings/users` | violet-500 |
| Roles | `/settings/roles` | indigo-500 |
| API Access | `/settings/api-keys` | amber-500 |

**Audit & System**
| Tile | Route | Icon colour |
|------|-------|-------------|
| Audit Log | `/settings/audit` | slate-500 |
| Changelog | `/settings/changelog` | emerald-500 |
| Feature Flags | `/settings/flags` | orange-500 |
| Documentation | `/settings/docs` | sky-500 |
| Feedback | `/settings/feedback` | rose-500 |

#### Tile component

```tsx
function SettingsTile({ href, icon, iconBg, title, description }: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) { ... }
```

- Renders a `<Link>` wrapping a card: coloured icon square (40×40px) + title + description + chevron right
- `hover:border-emerald-500/40 hover:shadow-sm` on hover
- Small card size — `p-4` not `p-6` — since the grid will grow

#### Sub-page layout pattern

Every sub-page wraps its content in:

```tsx
<div className="space-y-6">
  <div className="flex items-center gap-3">
    <Link href="/settings" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition">
      ← Settings
    </Link>
    <span className="text-gray-300 dark:text-slate-600">/</span>
    <h1 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h1>
  </div>
  {/* content */}
</div>
```

#### Shared helpers (`src/components/settings/shared.tsx`)

Exports:
- `StatusBadge` component
- `ActionBadge` component
- `ACTION_COLORS` record
- `ACTION_SHORT` record
- `AUDIT_ACTIONS` array

These are currently defined inline in `settings/page.tsx`. Move them verbatim; update all sub-pages to import from `@/components/settings/shared`.

---

## Feature 2: Notifications Bell

### Location

Top bar in `src/app/(dashboard)/layout.tsx`, between the theme toggle and the profile dropdown button.

### Markup

```tsx
<button
  title="Notifications"
  className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition relative"
  disabled
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
  {/* Static unread dot — amber, top-right of button */}
  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
</button>
```

`disabled` attribute prevents click. The amber dot is a static placeholder — not connected to any data.

---

## Feature 3: Feedback System

### 3.1 Database

Add to `initDb.ts` after existing table creations:

```sql
CREATE TABLE IF NOT EXISTS `feedback` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `user_id`        INT NULL,
  `user_email`     VARCHAR(200) NULL,
  `user_name`      VARCHAR(200) NULL,
  `type`           VARCHAR(20) NOT NULL DEFAULT 'rating',
  `rating`         TINYINT NULL,
  `message`        TEXT NULL,
  `screenshot_b64` MEDIUMTEXT NULL,
  `page_url`       VARCHAR(500) NULL,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `feedback_user_id_fk` (`user_id`),
  CONSTRAINT `feedback_user_id_fk` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
```

**Column details:**
- `type`: one of `"rating"` | `"suggestion"` | `"bug"` — `"rating"` means emoji-only, no text
- `rating`: 1–5 or NULL if user submitted type-only
- `screenshot_b64`: full base64 data URL (e.g. `data:image/jpeg;base64,...`) — NULL if not provided
- `message`: NULL if not provided

### 3.2 API Routes

#### `POST /api/feedback`

**File:** `src/app/api/feedback/route.ts`

Auth: any authenticated user. If API key session (`session.sub === "apikey"`), reject with 403.

Request body:
```ts
{
  type: "rating" | "suggestion" | "bug";  // required
  rating?: number;                          // 1–5
  message?: string;
  screenshot_b64?: string;                  // data URL
  page_url?: string;
}
```

Validation:
- `type` must be one of the three values
- `rating` if provided must be integer 1–5; otherwise ignored
- `message` trimmed; empty string treated as NULL
- `screenshot_b64`: no server-side size validation (MEDIUMTEXT holds up to 16 MB)
- Must have at least one of: `rating` or `message`; otherwise return 400

Insert:
```sql
INSERT INTO feedback (user_id, user_email, user_name, type, rating, message, screenshot_b64, page_url)
VALUES (${userId}, ${session.email}, ${session.name}, ${type}, ${rating ?? null}, ${message ?? null}, ${screenshot_b64 ?? null}, ${page_url ?? null})
```

Audit: `auditLog({ userId, action: "FEEDBACK_SUBMITTED", resource: "feedback", resourceId: String(insertId), ip: getIp(req) })`

Response: `{ ok: true }`

#### `GET /api/feedback`

**File:** `src/app/api/feedback/route.ts` (same file, second export)

Auth: admin only. Return 403 if `session.role !== "admin"`.

Query params: `page` (default 1), `limit` (default 25), `type` (optional filter: `"rating"` | `"suggestion"` | `"bug"`)

Response:
```ts
{
  entries: Array<{
    id: number;
    user_email: string | null;
    user_name: string | null;
    type: string;
    rating: number | null;
    message: string | null;
    screenshot_b64: string | null;
    page_url: string | null;
    created_at: string;
  }>;
  total: number;
}
```

SQL: paginated `SELECT` with optional `WHERE type = ?`. No JOIN needed (user info is denormalised on insert).

### 3.3 Feedback Component

**File:** `src/components/feedback.tsx`

Single file exporting `FeedbackWidget` — a client component that manages bubble + panel state together.

#### Install dependency

```bash
npm install html-to-image
```

#### State

```ts
const [open, setOpen] = useState(false);
const [rating, setRating] = useState<number | null>(null);
const [activeType, setActiveType] = useState<"suggestion" | "bug" | null>(null);
const [message, setMessage] = useState("");
const [screenshot, setScreenshot] = useState<
  | { stage: "none" }
  | { stage: "redacting"; dataUrl: string }
  | { stage: "ready"; dataUrl: string }
>({ stage: "none" });
const [submitting, setSubmitting] = useState(false);
const [submitted, setSubmitted] = useState(false);
const [error, setError] = useState<string | null>(null);
const panelRef = useRef<HTMLDivElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
```

#### Emoji constants

```ts
const EMOJIS = [
  { value: 1, label: "😫" },
  { value: 2, label: "😕" },
  { value: 3, label: "😐" },
  { value: 4, label: "😊" },
  { value: 5, label: "😄" },
];
```

#### Screen capture

```ts
async function captureScreen() {
  try {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(document.body, {
      filter: (node) => node !== panelRef.current,
      pixelRatio: 1,
    });
    setScreenshot({ stage: "ready", dataUrl });
  } catch {
    setError("Could not capture screen — please upload a screenshot instead");
  }
}
```

No redaction step (the coaches app has a redaction editor; keep it simple here).

#### File upload

```ts
function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setScreenshot({ stage: "ready", dataUrl: canvas.toDataURL("image/jpeg", 0.7) });
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}
```

#### Submit

```ts
async function handleSubmit() {
  if (!rating && !activeType) return;
  setError(null);
  setSubmitting(true);
  try {
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activeType ?? "rating",
        rating: rating ?? undefined,
        message: message.trim() || undefined,
        screenshot_b64: screenshot.stage === "ready" ? screenshot.dataUrl : undefined,
        page_url: pathname,
      }),
    });
    if (!r.ok) throw new Error();
    setSubmitted(true);
    setTimeout(() => { setOpen(false); resetForm(); }, 1500);
  } catch {
    setError("Failed to submit — please try again");
  } finally {
    setSubmitting(false);
  }
}
```

#### Panel layout

```
┌──────────────────────────────┐
│  Share Feedback          [×] │  ← header
├──────────────────────────────┤
│  How easy was this page?     │
│  😫  😕  😐  😊  😄         │  ← rating row
│                              │
│  [💡 Suggestion] [🐛 Bug]   │  ← type toggle
│                              │
│  (textarea if type selected) │
│                              │
│  Bug only:                   │
│  [📸 Capture] [📎 Upload]   │
│  or: [thumbnail] [Remove]   │
│                              │
│  (error message if any)      │
│  [Submit]                    │
└──────────────────────────────┘
```

Styling: `fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl`

**Success state:** replaces content with centred checkmark + "Thanks for your feedback!" for 1.5s before closing.

#### Bubble button

```tsx
<button
  onClick={() => setOpen(true)}
  className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition flex items-center justify-center"
  title="Send feedback"
>
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
</button>
```

#### Mounting in layout

In `src/app/(dashboard)/layout.tsx`, add at the bottom of the return statement (after the dropdown `{showProfile && ...}` area, before the closing `</div>`):

```tsx
import { FeedbackWidget } from "@/components/feedback";
// ...
<FeedbackWidget />
```

`FeedbackWidget` calls `usePathname()` internally to capture `page_url`.

### 3.4 Feedback Viewer (`/settings/feedback/page.tsx`)

Admin-only. On mount:
1. Check role from JWT cookie (`bp_token`) — if not admin, render access-restricted message
2. Fetch `GET /api/feedback?page=1&limit=25&type=<filter>`

Columns: Date · User · Type · Rating (emoji or —) · Message (truncated to 80 chars, full on hover) · Page · Screenshot

Screenshot column: if `screenshot_b64` is not null, show a `<img>` thumbnail (h-10 w-16 object-cover rounded, cursor-pointer). Clicking opens a modal with the full-size image.

Type filter: "All" | "Rating" | "Suggestion" | "Bug" toggle buttons.

Pagination: same pattern as `AuditTab` (Previous / Page N of M / Next).

### 3.5 OpenAPI spec

Add to `src/app/api/openapi/route.ts` under `paths`:

```json
"/feedback": {
  "post": {
    "tags": ["Feedback"],
    "summary": "Submit feedback",
    "description": "Submit user feedback including optional emoji rating, message, and screenshot. Requires at least one of rating or message.",
    "requestBody": { ... },
    "responses": {
      "200": { "description": "Feedback recorded" },
      "400": { "description": "Missing required fields" },
      "401": { "description": "Not authenticated" }
    }
  },
  "get": {
    "tags": ["Feedback"],
    "summary": "List feedback (admin)",
    "description": "Returns paginated feedback submissions. Admin only.",
    "parameters": [ page, limit, type ],
    "responses": {
      "200": { "description": "Paginated feedback list" },
      "401": { "description": "Not authenticated" },
      "403": { "description": "Admin only" }
    }
  }
}
```

Also add `FEEDBACK_SUBMITTED` to the `ACTION_COLORS` map and `AUDIT_ACTIONS` array in `src/components/settings/shared.tsx`.

---

## Changelog

Add to top of `src/data/changelog.ts`:
```ts
{ date: "2026-06-26", description: "Redesigned settings as a tile hub with individual sub-pages; added notifications bell and feedback system with screenshot capture" },
```

---

## Out of Scope

- Notifications bell functionality (data, count badge, dropdown) — deferred
- Feedback status management (mark as reviewed, resolve) — deferred
- Email notifications on new feedback — deferred
- Redaction editor on screenshots — deferred (coaches app has this; too complex for boilerplate)
