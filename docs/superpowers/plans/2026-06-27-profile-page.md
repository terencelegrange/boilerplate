# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/profile` page reachable from a simplified top-right dropdown that replaces the existing inline edit form.

**Architecture:** The dashboard layout dropdown is stripped to a pure navigation menu (Profile / Settings / Logout). A new `profile/page.tsx` under the dashboard layout group handles all profile editing via two independent cards — Identity and Change Password — both calling the existing `PATCH /api/me/profile` endpoint.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v3 (darkMode: "class"), existing `/api/me/profile` GET+PATCH route.

## Global Constraints

- All UI uses `dark:` Tailwind variants — no hardcoded colors
- Cards: `bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6`
- Inputs: `bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm`
- Primary buttons: `bg-emerald-500 hover:bg-emerald-600 text-white`
- No new API routes — use existing `GET /api/me/profile` and `PATCH /api/me/profile`
- Avatar range: integers 1–127 inclusive
- Port: 3333

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/(dashboard)/layout.tsx` | Modify | Strip inline form state/handlers; replace dropdown body with nav links |
| `src/app/(dashboard)/profile/page.tsx` | Create | Two-card profile page (Identity + Change Password) |
| `src/data/changelog.ts` | Modify | Add changelog entry at top of array |

---

### Task 1: Simplify the dropdown in layout.tsx

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**What to remove:**
- State: `showEditForm`, `editName`, `editEmail`, `editCurrentPw`, `editNewPw`, `editSaving`, `editError`, `editSuccess`
- Functions: `handleEditSave`, `randomizeAvatar`
- Inside `openDropdown`: the `fetch("/api/me/profile")` block and the `setEditName`/`setEditEmail` calls — the function body becomes just the toggle + reset of `showDropdown`

**What to keep:** `showDropdown`, `dropdownRef`, `avatar`, `userId`, `userName`, `role`, `isDark`, `flags`, `allowedNavKeys`, `getDisplayAvatar`, `toggleTheme`, `handleLogout`

**What to add:** fetch profile on mount (to populate `avatar` in the top-bar button), avatar display in dropdown header, three nav links.

- [ ] **Step 1: Replace the state declarations**

Remove these lines from the state block:

```tsx
const [showEditForm, setShowEditForm] = useState(false);
const [editName, setEditName] = useState("");
const [editEmail, setEditEmail] = useState("");
const [editCurrentPw, setEditCurrentPw] = useState("");
const [editNewPw, setEditNewPw] = useState("");
const [editSaving, setEditSaving] = useState(false);
const [editError, setEditError] = useState<string | null>(null);
const [editSuccess, setEditSuccess] = useState(false);
```

- [ ] **Step 2: Add avatar fetch to the mount useEffect**

Inside the existing `useEffect(() => { ... }, [])`, after the `setUserId` block, add:

```tsx
fetch("/api/me/profile")
  .then((r) => r.ok ? r.json() : null)
  .then((data) => { if (data) setAvatar(data.avatar ?? null); })
  .catch(() => {});
```

- [ ] **Step 3: Replace openDropdown and remove randomizeAvatar**

Replace the entire `openDropdown` function and delete `randomizeAvatar`:

```tsx
function openDropdown() {
  setShowDropdown((prev) => !prev);
}
```

- [ ] **Step 4: Remove handleEditSave**

Delete the entire `handleEditSave` async function.

- [ ] **Step 5: Replace the click-outside handler cleanup**

The click-outside `handleClickOutside` currently resets `showEditForm`, `editError`, `editSuccess`. Simplify it:

```tsx
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);
```

- [ ] **Step 6: Replace the dropdown JSX**

Find the `{showDropdown && ( <div className="absolute right-0 ...">` block and replace its entire contents with:

```tsx
{showDropdown && (
  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
    {/* Identity header */}
    <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800">
      <img
        src={`/avatars/${getDisplayAvatar(avatar, userId)}.png`}
        alt="avatar"
        className="w-10 h-10 rounded-full object-cover border border-emerald-500/30 flex-shrink-0"
      />
      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName}</p>
    </div>
    {/* Nav links */}
    <div className="px-2 py-2 space-y-0.5">
      <Link href="/profile" onClick={() => setShowDropdown(false)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        Your Profile
      </Link>
      <Link href="/settings" onClick={() => setShowDropdown(false)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
      </Link>
    </div>
    {/* Logout */}
    <div className="border-t border-gray-100 dark:border-slate-800 px-2 py-2">
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
```

- [ ] **Step 7: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors related to removed state variables or functions.

- [ ] **Step 8: Manual verification**

Start dev server (`npm run dev`) and navigate to any dashboard page. Confirm:
- Top-right button shows avatar + username
- Clicking it opens a dropdown with "Your Profile", "Settings", "Logout" — no edit form
- "Your Profile" navigates to `/profile` (404 expected until Task 2)
- "Settings" navigates to `/settings`
- "Logout" logs out

- [ ] **Step 9: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "refactor: simplify top-right dropdown to navigation menu"
```

---

### Task 2: Create the profile page

**Files:**
- Create: `src/app/(dashboard)/profile/page.tsx`

**Interfaces:**
- Consumes: `GET /api/me/profile` → `{ name: string | null, email: string, avatar: number | null }`
- Consumes: `PATCH /api/me/profile` with `{ name, email, avatar }` → `{ ok: true, name, email }`
- Consumes: `PATCH /api/me/profile` with `{ currentPassword, newPassword }` → `{ ok: true }` or `{ error: string }` (400)

- [ ] **Step 1: Create the file**

Create `src/app/(dashboard)/profile/page.tsx` with this full content:

```tsx
"use client";

import { useEffect, useState } from "react";

function getDisplayAvatar(av: number | null, uid: number | null): number {
  if (av !== null && av >= 1 && av <= 127) return av;
  if (!uid || uid <= 0) return 1;
  return ((uid - 1) % 127) + 1;
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<number | null>(null);

  // Identity form
  const [avatar, setAvatar] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identitySuccess, setIdentitySuccess] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    const token = document.cookie.split("; ").find((c) => c.startsWith("bp_token="))?.split("=")[1];
    if (token) {
      try {
        const p = JSON.parse(atob(token.split(".")[1]));
        setUserId(parseInt(p.sub ?? "0", 10) || null);
      } catch { /* ignore */ }
    }

    fetch("/api/me/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setAvatar(data.avatar ?? null);
        setName(data.name ?? "");
        setEmail(data.email ?? "");
      })
      .catch(() => {});
  }, []);

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

  async function handleIdentitySave(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(null);
    setIdentitySaving(true);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, avatar }),
      });
      const data = await r.json();
      if (!r.ok) { setIdentityError(data.error ?? "Failed to save"); return; }
      setIdentitySuccess(true);
      setTimeout(() => setIdentitySuccess(false), 3000);
    } catch {
      setIdentityError("Network error - please try again");
    } finally {
      setIdentitySaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) { setPwError("New passwords do not match"); return; }
    setPwSaving(true);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await r.json();
      if (!r.ok) { setPwError(data.error ?? "Failed to update password"); return; }
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError("Network error - please try again");
    } finally {
      setPwSaving(false);
    }
  }

  const displayAvatar = getDisplayAvatar(avatar, userId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage your account details and password</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Identity card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Identity</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">Update your name, email, and avatar</p>

          <form onSubmit={handleIdentitySave} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer flex-shrink-0" onClick={randomizeAvatar}>
                <img
                  src={`/avatars/${displayAvatar}.png`}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/30 group-hover:border-emerald-500 transition"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">Click avatar to randomize</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {identityError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{identityError}</p>
            )}
            {identitySuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">Profile updated successfully</p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={identitySaving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                {identitySaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Password card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Change Password</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">You must enter your current password to set a new one</p>

          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Current password</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">New password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Confirm new password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>

            {pwError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">Password updated successfully</p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={pwSaving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
                {pwSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With dev server running, navigate to `/profile`. Confirm:
- Page loads with current name and email pre-filled
- Avatar displays correctly; clicking randomizes it immediately
- Saving identity with a changed name shows success message
- Entering mismatched new passwords shows "New passwords do not match" without hitting the API
- Entering wrong current password shows "Current password is incorrect" from the API
- Correct password change succeeds and clears all three password fields

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/profile/page.tsx
git commit -m "feat: add profile page with identity and password change cards"
```

---

### Task 3: Changelog entry

**Files:**
- Modify: `src/data/changelog.ts`

- [ ] **Step 1: Add entry at the top of the CHANGELOG array**

Open `src/data/changelog.ts` and insert as the first element:

```ts
{ date: "2026-06-27", description: "Add dedicated profile page with identity and password change cards; simplify top-right dropdown to navigation links" },
```

- [ ] **Step 2: Commit**

```bash
git add src/data/changelog.ts
git commit -m "chore: changelog entry for profile page"
```
