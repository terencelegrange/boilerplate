# Profile Dropdown with Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-bar profile button (which opened a modal) with a dropdown panel that shows the user's avatar, allows randomizing it, lets the user edit their profile inline, and provides a logout button.

**Architecture:** Avatar stored as `SMALLINT NULL` in a new `avatar` column on `users`; `NULL` means use a deterministic default derived from user ID `((userId - 1) % 127) + 1`. A new `GET /api/me/profile` endpoint returns name/email/avatar. `PATCH /api/me/profile` is extended to accept `avatar`. The existing `ProfileModal` component is deleted and replaced by an inline dropdown anchored to the top-bar profile button.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v3, Prisma raw SQL (`$executeRaw`/`$queryRaw`), MySQL

## Global Constraints

- Raw SQL via `prisma.$executeRaw` / `$queryRaw` only — no Prisma model calls
- No new npm packages
- Tailwind `dark:` prefix for all dark-mode styles
- Dev port 3333
- Avatars live at `public/avatars/1.png` through `public/avatars/127.png`

---

### Task 1: Add avatar column to users table

**Files:**
- Modify: `src/lib/initDb.ts`

**Interfaces:**
- Produces: `users.avatar` column (SMALLINT NULL) available for all subsequent DB queries

- [ ] **Step 1: Add ALTER TABLE after the users CREATE TABLE**

In `src/lib/initDb.ts`, directly after the closing backtick of the `CREATE TABLE IF NOT EXISTS users` statement (around line 26), add:

```ts
await prisma.$executeRaw`
  ALTER TABLE \`users\`
  ADD COLUMN IF NOT EXISTS \`avatar\` SMALLINT NULL DEFAULT NULL
`;
```

- [ ] **Step 2: Manual verification**

Start the dev server (`npm run dev`). Hit http://localhost:3333 (you'll be redirected to /login — that's fine, the init runs on first authenticated request). Log in. Check MySQL:

```sql
DESCRIBE boilerplate.users;
```

Expected: `avatar` row with type `smallint`, Null `YES`, Default `NULL`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/initDb.ts
git commit -m "feat: add avatar column to users table"
```

---

### Task 2: Add GET /api/me/profile and extend PATCH for avatar

**Files:**
- Modify: `src/app/api/me/profile/route.ts`

**Interfaces:**
- Produces: `GET /api/me/profile` → `{ name: string | null, email: string, avatar: number | null }`
- Produces: `PATCH /api/me/profile` now also accepts `{ avatar: number }` (1–127) in the request body alongside existing fields

- [ ] **Step 1: Add GET handler**

At the top of `src/app/api/me/profile/route.ts`, add this function before the existing `export async function PATCH`:

```ts
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.sub, 10);
  const rows = await prisma.$queryRaw<{ name: string | null; email: string; avatar: number | null }[]>`
    SELECT name, email, avatar FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
```

- [ ] **Step 2: Extend PATCH to destructure and handle avatar**

In the existing `PATCH` handler, replace the destructure line:

```ts
const { name, email, currentPassword, newPassword } = await req.json();
```

with:

```ts
const { name, email, currentPassword, newPassword, avatar } = await req.json();
```

Then, after the `newPassword` block and before `if (updates.length === 0)`, add:

```ts
if (avatar !== undefined && Number.isInteger(avatar) && avatar >= 1 && avatar <= 127) {
  updates.push("avatar = ?");
  values.push(avatar);
}
```

- [ ] **Step 3: Manual verification**

With the dev server running, log in and grab the `bp_token` cookie from DevTools. Then:

```bash
# GET — should return name, email, avatar (null if not yet set)
curl -s -b "bp_token=<YOUR_TOKEN>" http://localhost:3333/api/me/profile

# PATCH avatar only
curl -s -X PATCH -b "bp_token=<YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"avatar": 42}' \
  http://localhost:3333/api/me/profile

# GET again — avatar should now be 42
curl -s -b "bp_token=<YOUR_TOKEN>" http://localhost:3333/api/me/profile
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/me/profile/route.ts
git commit -m "feat: add GET profile endpoint and avatar field to PATCH"
```

---

### Task 3: Replace ProfileModal with profile dropdown in layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/me/profile` → `{ name, email, avatar }`
- Consumes: `PATCH /api/me/profile` with `{ avatar }` or `{ name, email, currentPassword?, newPassword? }`
- Consumes: `POST /api/auth/logout`
- Consumes: `public/avatars/{n}.png` where n is 1–127

- [ ] **Step 1: Add useRef to the React import**

Replace:

```ts
import { useEffect, useState } from "react";
```

with:

```ts
import { useEffect, useRef, useState } from "react";
```

- [ ] **Step 2: Delete the ProfileModal component**

Remove the entire `ProfileModal` function — from `function ProfileModal(` down to its closing `}` (currently lines 8–107). It will be replaced by inline JSX in the dropdown.

- [ ] **Step 3: Replace state variables in DashboardLayout**

Inside `DashboardLayout`, replace:

```ts
const [showProfile, setShowProfile] = useState(false);
```

with:

```ts
const [showDropdown, setShowDropdown] = useState(false);
const [avatar, setAvatar] = useState<number | null>(null);
const [userId, setUserId] = useState<number | null>(null);
const [showEditForm, setShowEditForm] = useState(false);
const [editName, setEditName] = useState("");
const [editEmail, setEditEmail] = useState("");
const [editCurrentPw, setEditCurrentPw] = useState("");
const [editNewPw, setEditNewPw] = useState("");
const [editSaving, setEditSaving] = useState(false);
const [editError, setEditError] = useState<string | null>(null);
const [editSuccess, setEditSuccess] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Capture userId in the existing useEffect**

In the existing `useEffect`, after `setUserName(p.name ?? p.email ?? null)`, add:

```ts
setUserId(parseInt(p.sub ?? "0", 10) || null);
```

(`p.sub` is the user ID string stored in the JWT — see `src/lib/auth.ts` `JwtPayload.sub`.)

- [ ] **Step 5: Add click-outside handler**

Add a second `useEffect` in `DashboardLayout` (after the first one):

```ts
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
      setShowEditForm(false);
      setEditError(null);
      setEditSuccess(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);
```

- [ ] **Step 6: Add helper functions**

Add these inside `DashboardLayout`, after the existing `handleLogout` function:

```ts
function getDisplayAvatar(av: number | null, uid: number | null): number {
  if (av !== null && av >= 1 && av <= 127) return av;
  if (!uid || uid <= 0) return 1;
  return ((uid - 1) % 127) + 1;
}

async function openDropdown() {
  const next = !showDropdown;
  if (next) {
    try {
      const r = await fetch("/api/me/profile");
      if (r.ok) {
        const data = await r.json();
        setAvatar(data.avatar ?? null);
        setEditName(data.name ?? "");
        setEditEmail(data.email ?? "");
      }
    } catch { /* ignore */ }
  }
  setShowDropdown(next);
  setShowEditForm(false);
  setEditError(null);
  setEditSuccess(false);
}

async function randomizeAvatar() {
  const current = getDisplayAvatar(avatar, userId);
  let next: number;
  do { next = Math.floor(Math.random() * 127) + 1; } while (next === current);
  setAvatar(next);
  await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar: next }),
  });
}

async function handleEditSave(e: React.FormEvent) {
  e.preventDefault();
  setEditError(null);
  setEditSaving(true);
  const body: Record<string, string> = { name: editName, email: editEmail };
  if (editNewPw) { body.currentPassword = editCurrentPw; body.newPassword = editNewPw; }
  const r = await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  setEditSaving(false);
  if (!r.ok) { setEditError(data.error ?? "Failed to save"); return; }
  setEditSuccess(true);
  setUserName(data.name ?? editName);
  setEditCurrentPw("");
  setEditNewPw("");
  setTimeout(() => { setEditSuccess(false); setShowEditForm(false); }, 1200);
}
```

- [ ] **Step 7: Replace the top-bar profile button with the dropdown**

In the top bar JSX, replace:

```tsx
{userName && (
  <button onClick={() => setShowProfile(true)}
    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition group">
    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {userName[0].toUpperCase()}
      </span>
    </div>
    <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">{userName}</span>
    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  </button>
)}
```

with:

```tsx
{userName && (
  <div className="relative" ref={dropdownRef}>
    <button onClick={openDropdown}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition group">
      <img
        src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
        alt="avatar"
        className="w-7 h-7 rounded-full object-cover border border-emerald-500/30"
      />
      <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">{userName}</span>
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showDropdown ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
      </svg>
    </button>

    {showDropdown && (
      <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
        {/* Avatar + identity header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800">
          <div className="relative group/av cursor-pointer flex-shrink-0" onClick={randomizeAvatar}>
            <img
              src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 group-hover/av:border-emerald-500 transition"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/av:opacity-100 transition flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Click avatar to randomize</p>
          </div>
        </div>

        {/* Edit profile section */}
        <div className="px-4 py-2">
          {!showEditForm ? (
            <button
              onClick={() => { setShowEditForm(true); setEditError(null); setEditSuccess(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Profile
            </button>
          ) : editSuccess ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-3 justify-center text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Profile updated
            </div>
          ) : (
            <form onSubmit={handleEditSave} className="space-y-3 py-2">
              {editError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{editError}</p>
              )}
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              <div className="border-t border-gray-100 dark:border-slate-800 pt-2 space-y-2">
                <input
                  type="password"
                  value={editCurrentPw}
                  onChange={(e) => setEditCurrentPw(e.target.value)}
                  placeholder="Current password"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <input
                  type="password"
                  value={editNewPw}
                  onChange={(e) => setEditNewPw(e.target.value)}
                  placeholder="New password"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEditForm(false); setEditError(null); }}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-2">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 8: Remove sidebar user display and ProfileModal render**

In the sidebar "Bottom" section, delete the entire user display block:

```tsx
{/* User */}
{userName && (
  <div className="flex items-center gap-2.5 px-3 py-2">
    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {userName[0].toUpperCase()}
      </span>
    </div>
    <span className="text-xs text-gray-500 dark:text-slate-400 truncate">{userName}</span>
  </div>
)}
```

Also delete the ProfileModal render at the bottom of the return statement:

```tsx
{/* Profile modal */}
{showProfile && (
  <ProfileModal
    userName={userName}
    onClose={() => setShowProfile(false)}
    onSaved={(name) => setUserName(name ?? userName)}
  />
)}
```

- [ ] **Step 9: Manual verification**

1. Dev server at http://localhost:3333 — log in
2. Top bar shows avatar image (deterministic from user ID) + name + chevron
3. Click profile button — dropdown opens with large avatar, name, "Click avatar to randomize" hint
4. Click the avatar image — it changes immediately; refresh page and confirm the new avatar persists
5. Click "Edit Profile" — form expands with pre-filled name and email
6. Change name, click Save — success message shows briefly, name updates in top bar, form collapses
7. Enter wrong current password + new password — error message shown
8. Click Cancel — form collapses, no changes
9. Click Logout — redirected to /login
10. Click outside the open dropdown — it closes
11. Dark mode toggle (sun/moon icon) still works independently

- [ ] **Step 10: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: replace profile modal with dropdown; add avatar picker and inline profile editing"
```

---

### Task 4: Changelog entry

**Files:**
- Modify: `src/data/changelog.ts`

- [ ] **Step 1: Add entry at the top of the CHANGELOG array**

```ts
{ date: "2026-06-26", description: "Add profile dropdown with avatar picker, inline profile editing, and logout button" },
```

- [ ] **Step 2: Commit**

```bash
git add src/data/changelog.ts
git commit -m "chore: changelog entry for profile dropdown"
```
