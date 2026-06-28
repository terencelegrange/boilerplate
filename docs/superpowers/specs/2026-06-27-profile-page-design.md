# Profile Page Design

**Date:** 2026-06-27
**Status:** Approved

## Overview

Add a dedicated `/profile` page reachable from a simplified top-right dropdown menu. The page lets the current user update their identity (name, email, avatar) and change their password via two independent cards. All inline profile editing is removed from the dropdown.

---

## Dropdown Menu Changes

**File:** `src/app/(dashboard)/layout.tsx`

The dropdown is stripped of all inline form state and becomes a pure navigation menu. Remove:
- `showEditForm`, `editName`, `editEmail`, `editCurrentPw`, `editNewPw`, `editSaving`, `editError`, `editSuccess` state
- `handleEditSave` function
- Avatar click-to-randomize (`randomizeAvatar`) and related overlay
- The `openDropdown` function's profile fetch (no longer needed)

Replace the dropdown body with three navigation links:

| Item | Destination | Visibility |
|---|---|---|
| Your Profile | `/profile` | All authenticated users |
| Settings | `/settings` | All authenticated users (page itself enforces admin-only content) |
| Logout | POST `/api/auth/logout` → `/login` | All authenticated users |

The avatar + username identity header remains at the top of the dropdown. Avatar is display-only in the dropdown (no randomize on click).

The `avatar` state and `getDisplayAvatar` helper are retained for the avatar display in the top bar button and dropdown header.

---

## Profile Page

**File:** `src/app/(dashboard)/profile/page.tsx` (new)

A `"use client"` page under the dashboard layout group. On mount, fetches `GET /api/me/profile` to populate all fields.

### Card 1 — Identity

Fields:
- Avatar — large (56px), clickable to randomize. On click: picks a random avatar number (1–127, not the current one), optimistically updates display, calls `PATCH /api/me/profile` with `{ avatar: N }`.
- Name — optional text input
- Email — required email input

Save button: `PATCH /api/me/profile` with `{ name, email, avatar }`. On success, re-issues a JWT (handled server-side); display updates in place. Success and error messages render inline within the card.

### Card 2 — Change Password

Fields:
- Current password (required when submitting)
- New password (required)
- Confirm new password (client-side match check only)

Save button: `PATCH /api/me/profile` with `{ currentPassword, newPassword }`. Clears all three fields on success. Error (wrong current password, network error) renders inline within the card.

### Styling

Follows the existing pattern in `settings/page.tsx`:
- Page heading + subtitle at top
- Cards: `bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6`
- Inputs: `bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm`
- Primary button: `bg-emerald-500 hover:bg-emerald-600 text-white`
- Max content width: `max-w-xl` (narrower than the full settings page — profile forms don't need full width)

---

## API

No new API routes. The existing `GET /api/me/profile` and `PATCH /api/me/profile` in `src/app/api/me/profile/route.ts` already support all required operations (name, email, password, avatar).

---

## Nav / RBAC

No changes to `src/data/nav.ts`. The profile page is not a sidebar nav item — it's only reachable from the dropdown menu. It requires authentication (covered by middleware) but no special role.

---

## Changelog

Add to top of `src/data/changelog.ts`:
```ts
{ date: "2026-06-27", description: "Add dedicated profile page with identity and password change cards; simplify top-right dropdown to navigation links" },
```
