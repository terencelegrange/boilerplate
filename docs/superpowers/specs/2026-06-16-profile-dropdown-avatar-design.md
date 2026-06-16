# Profile Dropdown, Avatar Picker, and Theme Toggle Relocation

## Purpose

Replace the top-right profile button (which currently opens the Edit Profile
modal directly) with a dropdown menu, add the ability for a user to pick a
random avatar image for themselves, and relocate the dark/light theme toggle
from the sidebar to the top bar next to the new profile dropdown.

## Avatar Source

128 avatar PNGs already exist at
`c:/development/tennisx/coaches/public/images/avatars/{1..128}.png`. These
will be copied once into `boilerplate/public/images/avatars/` so the
boilerplate app can serve them as static assets without depending on another
project's filesystem layout.

## Data Model

Add a nullable `avatar` column to the `users` table:

```sql
ALTER TABLE users ADD COLUMN avatar VARCHAR(20) NULL;
```

- Stores the avatar's filename stem (e.g. `"42"` for `42.png`), or `NULL` if
  the user has no avatar set (falls back to the existing initials-circle
  display).
- `initDb.ts`'s `CREATE TABLE IF NOT EXISTS users` statement gets the column
  added directly for fresh databases.
- For already-provisioned databases, `initDb()` adds a guarded migration step
  that checks `information_schema.columns` for the `avatar` column on the
  `users` table before issuing the `ALTER TABLE`, consistent with this file's
  existing raw-SQL, idempotent-on-every-boot style (it already does
  `INSERT IGNORE` for seed data).

## Top Bar Changes

The current top bar profile button (`(dashboard)/layout.tsx`) is replaced
with a new `ProfileMenu` client component containing, left to right:

1. **Theme toggle icon button** — sun/moon icon only, no label. This is
   moved here from its current location in the sidebar's bottom section;
   the sidebar loses this control entirely (no duplication).
2. **Profile button** — shows the user's avatar image (or initials-circle
   fallback) and name, same visual treatment as today. Clicking it opens a
   small dropdown (not the modal directly) with two items:
   - **Edit Profile** — opens the existing `ProfileModal`.
   - **Logout** — calls the existing logout handler.

The sidebar's existing standalone **Logout** button is left untouched (per
explicit decision — some redundancy with the dropdown's Logout item is
acceptable).

The dropdown is a small custom implementation (no new menu library), matching
this codebase's existing hand-rolled UI patterns: closes on outside click or
Escape, basic hover states.

## Avatar Selection — Randomize on Click

No avatar picker grid. Instead, inside `ProfileModal`:

- A circular avatar preview is shown at the top of the form (current avatar
  image, or initials if none set), with a small "click to change" hint
  beneath it.
- Clicking the avatar circle picks a new random avatar number from 1–128,
  excluding whatever is currently displayed (so a click always visibly
  changes the preview), and updates the preview immediately. This is pure
  client-side state — no network request on click.
- The chosen avatar number is only persisted when the user clicks **Save
  changes**, sent as `avatar` (string number, or omitted/`null` if reset) in
  the existing `PATCH /api/me/profile` request body, alongside `name` and
  `email`.
- Anywhere the initials-circle currently renders for this user (sidebar user
  row, top bar profile button), it renders the chosen avatar image instead
  once one is set, falling back to initials when `avatar` is `null`.

## API Changes

`PATCH /api/me/profile` (`src/app/api/me/profile/route.ts`):

- Accept an optional `avatar` field in the request body alongside the
  existing `name`, `email`, `currentPassword`, `newPassword`.
- Follows the exact same conditional-update pattern already used for `name`:
  `if (avatar !== undefined) { updates.push("avatar = ?"); values.push(avatar || null); }`
- No change to audit logging (`USER_UPDATED` action already covers this).
- `avatar` is added to the JWT payload everywhere it's currently signed,
  exactly like the existing `name` field (also mutable profile data carried
  in the token rather than re-fetched separately):
  - `src/lib/auth.ts` — extend the session payload type with `avatar: string | null`.
  - `src/app/api/auth/login/route.ts` — select `avatar` in the `UserRow`
    query and pass it into `signToken(...)`.
  - `src/app/api/me/profile/route.ts` — include `avatar` in the re-fetch
    (`SELECT email, role, name, avatar ...`) and pass it into the re-issued
    `signToken(...)` call so the cookie reflects the new avatar immediately
    without requiring a fresh login.
- The `(dashboard)/layout.tsx` client code already decodes `name`/`email`/
  `role` from the JWT cookie on mount; it's extended to also read `avatar`
  from the same decoded payload. No new endpoint needed.

## Error Handling

- Avatar copy into `public/` is a one-time build-time step, not user-facing —
  no runtime error handling needed.
- `PATCH /api/me/profile` already has full error handling (401 unauthenticated,
  400 on bad password); the new `avatar` field rides along the same code path
  with no new failure modes.

## Testing / Verification

This codebase has no automated test suite. Verification will be manual:

1. Start the dev server, log in.
2. Open the profile dropdown — confirm theme toggle and Edit Profile/Logout
   items appear correctly, sidebar Logout untouched.
3. Open Edit Profile, click the avatar circle several times — confirm it
   changes to a different image each time.
4. Save — confirm the modal closes, and the new avatar now renders in both
   the sidebar user row and the top bar profile button.
5. Reload the page — confirm the avatar persists (round-trips through the DB
   correctly via the `/api/rbac/me` fetch).
6. Toggle theme from the new top-bar location — confirm it still persists
   via `/api/me/theme` exactly as before.
