# Remember Me / Netflix-Style Login Design

**Date:** 2026-08-01
**Status:** Approved

## Overview

Two changes to the auth UI:
1. Remove the redundant standalone Logout button from the sidebar bottom-left (the profile dropdown already has its own Logout item).
2. Add a "Remember me" checkbox to login. When checked, the browser remembers the account as an avatar tile on future visits to `/login` — a Netflix-style "who's signing in" picker supporting multiple remembered profiles. Logging out removes only the current user's tile.

Note: avatar display, click-to-randomize, and the `/profile` page already exist and are unaffected by this spec.

---

## 1. Remove sidebar logout

**File:** `src/app/(dashboard)/layout.tsx`

Delete the bottom `<div className="px-3 py-4 border-t ...">` block containing the standalone Logout button (currently ~lines 132-141). The `handleLogout` function stays — it's still used by the dropdown's Logout item.

---

## 2. Remembered-profiles cookie

A new non-httpOnly cookie `bp_remembered` stores a JSON array of up to 5 entries:

```ts
{ id: number; email: string; name: string | null; avatar: number | null }[]
```

No secrets are stored — this is display/prefill data only, same trust level as the existing `bp_theme` cookie. `sameSite: "lax"`, `path: "/"`, `maxAge: 60 * 60 * 24 * 365`.

**Written by:** `POST /api/auth/login` (`src/app/api/auth/login/route.ts`). Request body gains an optional `rememberMe: boolean`. On successful login with `rememberMe: true`:
- Read the existing `bp_remembered` cookie from the request (if present), parse it (fall back to `[]` on any parse error).
- Remove any existing entry with the same `id`, then unshift the new `{ id, email, name, avatar }` entry.
- Truncate to 5 entries.
- Set the cookie on the response.

If `rememberMe` is falsy, the cookie is left untouched (existing entries for that account, if any, are neither added nor removed).

**Cleared (partially) by:** `POST /api/auth/logout` (`src/app/api/auth/logout/route.ts`). Reads `bp_remembered`, removes the entry matching the current session's user id, and re-sets the cookie with the filtered array (or clears it entirely if the array becomes empty). This is the "logout resets this feature" behavior, scoped to the one account that just logged out — other remembered profiles on the same browser are unaffected.

---

## 3. Login page picker UI

**File:** `src/app/login/page.tsx`

On mount, read `bp_remembered` from `document.cookie` and parse it client-side.

**If the array is non-empty**, render a profile-picker view instead of jumping straight to the form:
- A heading ("Who's signing in?") and a responsive grid of avatar tiles, one per remembered profile — avatar image (`/avatars/{n}.png`, falling back the same way `getDisplayAvatar` does elsewhere) + name/email underneath.
- Clicking a tile switches to a compact password-only form: shows that profile's avatar + name again, a single password input, and a "Sign in" button. The email is carried in component state (not re-typed).
- A "Not you? Use a different account" text link beneath the tiles (and beneath the password-only form) switches to the normal full email+password form — this is the same form used today, unchanged.
- Submitting any form (password-only or full) posts to `/api/auth/login` as today; the password-only path always sends `rememberMe: true` for that account (it's already remembered) so the tile's data (name/avatar) refreshes if changed.

**If the array is empty**, behavior is unchanged from today — the full email+password form renders directly, now with a "Remember me" checkbox (default unchecked) next to/above the submit button. Its value is sent as `rememberMe` in the login request body.

Both the full form and the password-only form share the same submit handler logic (call login API, `router.push("/")` on success, show inline error on failure) — only the fields differ.

---

## Error Handling

- Cookie parse failures (corrupted/tampered `bp_remembered`) are swallowed and treated as an empty list, both client-side (login page) and server-side (login/logout routes) — never throw, just fall back.
- No new server error responses are introduced; `/api/auth/login` and `/api/auth/logout` keep their existing status codes.

## Testing / Verification

No automated test suite exists for this UI flow beyond the existing Vitest API route tests. Manual verification:
1. Log in with "Remember me" checked — confirm `bp_remembered` cookie is set.
2. Reload `/login` — confirm the avatar tile appears instead of the full form.
3. Click the tile, enter password, sign in — confirm it logs in successfully.
4. Log in with a second account + Remember me — confirm both tiles now appear on `/login`.
5. Log out from one account — confirm only that account's tile disappears, the other remains.
6. Click "Not you?" — confirm the full form appears and a fresh login without Remember me does not add a tile.
7. Confirm the sidebar no longer shows a bottom-left Logout button, and the dropdown's Logout still works.

Add to top of `src/data/changelog.ts`:
```ts
{ date: "2026-08-01", description: "Add Remember me / multi-profile login picker and remove redundant sidebar logout button" },
```
