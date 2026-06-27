# Test Coverage Design — Boilerplate Admin App

**Date:** 2026-06-27  
**Scope:** Backend only (lib + API routes + middleware)  
**Status:** Approved

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Test runner | Vitest | Native ESM/TS support, no Babel, fast |
| Coverage | `@vitest/coverage-v8` | Zero-config, accurate |
| DB strategy | Real RDS `boilerplate_test` schema | Real SQL, real constraints |
| Test isolation | Truncate tables before each test | Fully independent, no cascade failures |
| Invocation | Direct handler calls (no HTTP server) | Fast, type-safe, no boot overhead |

---

## Infrastructure

### Files Created

```
src/test/
  setup.ts          # globalSetup: initDb(); beforeEach: truncate + re-seed flags
  helpers.ts        # makeAdmin, makeUser, makeToken, authedRequest, adminRequest
vitest.config.ts    # root config, loads .env.test
.env.test           # DATABASE_URL pointing to boilerplate_test schema
```

### `.env.test`
Same credentials as `.env` but with `DATABASE_URL` pointing to the `boilerplate_test` schema.

### `vitest.config.ts`
- `environment: "node"`
- `setupFiles: ["src/test/setup.ts"]`
- `envFile: ".env.test"`
- Coverage: `provider: "v8"`, `reporter: ["text", "lcov"]`

### `src/test/setup.ts`
```
beforeAll  → initDb()
beforeEach → truncate in FK-safe order:
               audit_logs → api_keys → role_permissions → users → feature_flags → changelog
           → re-seed 3 default feature flags (signup, dashboard, menu — all enabled)
```

### `next/headers` mock

`getSession()` calls `await cookies()` and `await headers()` from `next/headers`. These are Next.js server context APIs that do not exist in a plain Vitest environment — calling a route handler directly without this mock will throw.

Solution: declare a global `vi.mock('next/headers', ...)` in `vitest.config.ts`'s `setupFiles` so every test file gets the mock. The mock exposes `cookies` and `headers` as `vi.fn()` stubs that tests configure per-test.

### `src/test/helpers.ts`

| Helper | Purpose |
|---|---|
| `makeUser(overrides?)` | Insert approved user, return record + plaintext password |
| `makeAdmin(overrides?)` | Insert admin user, return record + plaintext password |
| `makeToken(payload)` | Call `signToken()`, return JWT string |
| `mockAuth(token)` | Configure `cookies` mock to return `{ bp_token: token }` and `headers` mock to return empty headers — call this before invoking any authenticated handler |
| `mockNoAuth()` | Configure `cookies` and `headers` mocks to return no token — for testing 401 responses |
| `makeRequest(method, url, body?)` | Construct a `Request` object (for body/URL params — auth comes from the mock, not from this object) |
| `adminRequest(url, method?, body?)` | `makeAdmin` + `makeToken` + `mockAuth` + `makeRequest` in one call |

### `package.json` scripts added
```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

---

## New Dependencies

```
vitest
@vitest/coverage-v8
```

No other new dependencies. `@types/node` already present.

---

## Test Files

### Lib layer — `src/test/lib/`

#### `auth.test.ts` (~7 tests)
- `signToken` produces a non-empty string whose decoded payload matches input
- `verifyToken` returns payload for a valid token
- `verifyToken` returns null for an expired token
- `verifyToken` returns null for a tampered token
- `getSession` reads `bp_token` cookie from a Request; returns payload
- `getSession` returns null when cookie is absent
- `getSessionFromApiKey` (via `getSession` with Bearer header): active key → returns admin payload + updates `last_used`; revoked key → null; expired key → null; unknown key → null

#### `audit.test.ts` (~3 tests)
- `auditLog` inserts a row with the correct action and resource
- `auditLog` does not throw when DB call fails
- `getIp` returns first IP from `x-forwarded-for`; returns null when header absent

#### `flags.test.ts` (~3 tests)
- Known flag enabled → true
- Known flag disabled (update DB first) → false
- Unknown flag key → true (fail-open)

#### `initDb.test.ts` (~3 tests)
- Calling `initDb()` twice does not throw or duplicate seed rows
- `hashPassword` + `verifyPassword`: correct password verifies; wrong password does not; hash is not plaintext
- Admin user seeded from env vars; second `initDb()` does not create a duplicate

---

### API routes — `src/test/api/`

#### `auth.test.ts` (~15 tests)

**POST /api/auth/login**
- Valid credentials → 200 + `bp_token` cookie set
- Wrong password → 401
- Pending user → 403
- Rejected user → 403
- Missing email or password → 400

**POST /api/auth/logout**
- Authenticated → 200 + `bp_token` cookie cleared
- Unauthenticated → 200 (logout is always safe)

**POST /api/auth/signup**
- Valid new user → 200 + user created with `pending` status
- Signup flag disabled → 423
- Duplicate email → 409
- Password under 8 characters → 400

#### `users.test.ts` (~10 tests)

**GET /api/users**
- Admin → 200 + array of users
- Non-admin → 403
- Unauthenticated → 401

**PATCH /api/users/[id]**
- Admin approves pending user → 200 + status updated in DB
- Admin changes role → 200 + role updated in DB
- Admin modifies own account → 400
- Non-admin → 403

**DELETE /api/users/[id]**
- Admin deletes another user → 200 + row removed
- Admin attempts self-delete → 400
- Non-admin → 403

#### `me.test.ts` (~12 tests)

**GET /api/me/profile**
- Authenticated → 200 + `{ id, name, email, avatar }`
- Unauthenticated → 401

**PATCH /api/me/profile — identity**
- Updates name and email → 200 + new JWT cookie issued
- Avatar in range 1–127 → 200
- Avatar out of range → 400

**PATCH /api/me/profile — password**
- Correct current password → 200 + new hash stored in DB
- Wrong current password → 400

**PATCH /api/me/theme**
- `dark` → 200 + `bp_theme` cookie set to `dark`
- `light` → 200 + `bp_theme` cookie set to `light`
- Invalid value → 400

#### `dashboard.test.ts` (~6 tests)

**GET /api/dashboard**
- Authenticated → 200 + has `totalUsers`, `pendingUsers`, `recentUsers`
- Unauthenticated → 401

**GET /api/settings/overview**
- Admin → 200 + has `totalUsers`, `pendingUsers`, `auditEvents`, `newUsers`, `recentAudit`
- Non-admin → 403
- Unauthenticated → 401

#### `audit.test.ts` (~6 tests)

**GET /api/audit**
- Admin, no filter → 200 + `{ rows, total, page, limit }`
- Action filter → only matching rows returned
- `page` and `limit` query params respected
- Non-admin → 403
- Unauthenticated → 401
- Audit log entry created when a login occurs (cross-check)

#### `feature-flags.test.ts` (~8 tests)

**GET /api/feature-flags**
- Authenticated → 200 + object keyed by flag key
- Unauthenticated → 401

**PATCH /api/feature-flags/[key]**
- Admin toggles flag off → 200 + DB updated + audit log written
- Admin toggles flag on → 200 + DB updated
- Unknown key → 404
- Non-admin → 403
- Missing `enabled` field → 400

#### `api-keys.test.ts` (~12 tests)

**GET /api/api-keys**
- Admin → 200 + array with metadata (no raw key in response)
- Non-admin → 403
- Unauthenticated → 401

**POST /api/api-keys**
- Valid → 200 + returns raw key + prefix; raw key not stored in DB (only hash)
- Missing name → 400
- Missing contact → 400

**PATCH /api/api-keys/[id]**
- Revoke active key → 200 + `active = false`
- Re-enable revoked key → 200 + `active = true`
- Non-admin → 403

**DELETE /api/api-keys/[id]**
- Admin → 200 + row removed from DB
- Non-admin → 403

#### `rbac.test.ts` (~8 tests)

**GET /api/rbac**
- Admin → 200 + full `{ viewer, editor, admin }` matrix
- Non-admin → 403
- Unauthenticated → 401

**PUT /api/rbac**
- Replaces all permissions → 200 + DB reflects new matrix
- Audit log written with `RBAC_UPDATED`
- Non-admin → 403

**GET /api/rbac/me**
- Viewer role → returns viewer nav keys
- Admin role → returns admin nav keys
- `user` role (legacy) → maps to viewer nav keys
- Unauthenticated → 401

#### `misc.test.ts` (~4 tests)

**GET /api/changelog**
- Authenticated → 200 + array ordered by date DESC
- Unauthenticated → 401

**GET /api/openapi**
- Authenticated → 200 + response has `openapi` and `paths` keys
- Unauthenticated → 401

---

### Middleware — `src/test/middleware.test.ts` (~8 tests)

Import `middleware` directly, construct `NextRequest`, assert on response.

- `/login` → passes through (no redirect)
- `/api/auth/login` → passes through
- `/api/auth/signup` → passes through
- Protected page `/` + valid `bp_token` cookie → passes through
- Protected page `/` + no cookie → 302 redirect to `/login`
- Protected page `/` + tampered token → 302 redirect to `/login`
- Protected API `/api/users` + no cookie → 401 JSON
- Protected API `/api/users` + valid token → passes through

---

## Test Count Summary

| Layer | Files | Tests |
|---|---|---|
| Lib | 4 | ~16 |
| API routes | 8 | ~81 |
| Middleware | 1 | ~8 |
| **Total** | **13** | **~105** |

---

## Out of Scope (this pass)

- React component tests
- End-to-end browser tests (Playwright/Cypress)
- Performance/load tests
- CI/CD pipeline configuration
