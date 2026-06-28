# Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~105 Vitest integration tests covering all lib functions, API route handlers, and middleware against a real MySQL test database.

**Architecture:** Direct handler invocation (no HTTP server) — import each route handler and call it with a constructed `Request` object. `getSession()` uses `next/headers`, which is mocked globally via `vi.mock` in `setupFiles`. A `globalSetup` file loads `.env.test` before Prisma initialises. Tables are truncated and feature flags re-seeded before each test.

**Tech Stack:** Vitest 2.x, `@vitest/coverage-v8`, `dotenv`, TypeScript, Prisma 5, MySQL (RDS `boilerplate_test` schema)

## Global Constraints

- Test database schema name: `boilerplate_test` (same RDS host as dev)
- Test runner: `vitest` — never `jest`
- No HTTP server — call handlers directly
- `next/headers` must be mocked in every file that invokes a handler calling `getSession()`
- Dynamic route params shape: `{ params: Promise<{ id: string }> }` (Next.js 15)
- All new files live under `src/test/`
- Never modify source files under `src/app/` or `src/lib/` — tests must pass against the existing implementation

---

## File Map

```
src/test/
  globalSetup.ts              # loads .env.test before Prisma initialises
  setup.ts                    # vi.mock next/headers; beforeAll initDb; beforeEach truncate+reseed
  helpers.ts                  # makeUser, makeAdmin, makeToken, mockAuth, mockNoAuth, makeRequest, adminRequest, userRequest
  smoke.test.ts               # verifies DB connection (deleted after Task 2)
  lib/
    auth.test.ts
    audit.test.ts
    flags.test.ts
    initDb.test.ts
  api/
    auth.test.ts
    users.test.ts
    me.test.ts
    dashboard.test.ts
    audit.test.ts
    feature-flags.test.ts
    api-keys.test.ts
    rbac.test.ts
    misc.test.ts
  middleware.test.ts
vitest.config.ts
.env.test                     # DATABASE_URL pointing to boilerplate_test
```

**Modified:**
- `package.json` — add devDependencies + test scripts

---

### Task 1: Install Vitest and create config

**Files:**
- Create: `vitest.config.ts`
- Create: `.env.test`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm test` command that runs Vitest in node environment with `@` alias resolved

- [ ] **Step 1: Install dependencies**

```bash
cd c:\Development\boilerplate
npm install --save-dev vitest @vitest/coverage-v8 dotenv
```

Expected: packages added to `node_modules`, `package.json` devDependencies updated.

- [ ] **Step 2: Add test scripts to package.json**

Open `package.json`. In the `"scripts"` block, add after the existing entries:

```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["src/test/globalSetup.ts"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/app/api/**", "src/middleware.ts"],
      exclude: ["src/lib/prisma.ts"],
    },
  },
});
```

- [ ] **Step 4: Create .env.test**

Create `.env.test` at the project root. The user must fill in the real credentials for the `boilerplate_test` schema:

```
# Test database — separate schema on the same RDS host as development
# Replace with actual credentials before running tests
DATABASE_URL="mysql://USER:PASS@HOST:3306/boilerplate_test"
JWT_SECRET="test-jwt-secret-not-for-production"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD_HASH="$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
```

The `ADMIN_PASSWORD_HASH` above is a bcrypt hash of `"password"` (cost 10) — fine for tests.

- [ ] **Step 5: Create the boilerplate_test schema on RDS**

Run this once on the RDS instance (not in the app):

```sql
CREATE DATABASE IF NOT EXISTS boilerplate_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 6: Verify TypeScript compiles the config**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Create globalSetup, setup, helpers, and smoke test

**Files:**
- Create: `src/test/globalSetup.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/helpers.ts`
- Create: `src/test/smoke.test.ts`

**Interfaces:**
- Produces:
  - `makeUser(overrides?) → Promise<TestUser>`
  - `makeAdmin(overrides?) → Promise<TestUser>`
  - `makeToken(payload: JwtPayload) → Promise<string>`
  - `mockAuth(token: string) → void`
  - `mockNoAuth() → void`
  - `makeRequest(method, url, body?) → Request`
  - `adminRequest(url, method?, body?) → Promise<Request>`
  - `userRequest(url, method?, body?) → Promise<{ req: Request; user: TestUser }>`

- [ ] **Step 1: Create src/test/globalSetup.ts**

```typescript
// src/test/globalSetup.ts
import { config } from "dotenv";
import { resolve } from "path";

export default function () {
  config({ path: resolve(process.cwd(), ".env.test"), override: true });
}
```

- [ ] **Step 2: Create src/test/setup.ts**

```typescript
// src/test/setup.ts
import { vi, beforeAll, beforeEach } from "vitest";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

// Mock next/headers globally — getSession() calls cookies() and headers()
// from next/headers, which only exist inside the Next.js server runtime.
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  // Reset auth mocks to unauthenticated state
  vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);
  vi.mocked(headers).mockResolvedValue(new Headers() as any);

  // Truncate in FK-safe order
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
  await prisma.$executeRaw`TRUNCATE TABLE audit_logs`;
  await prisma.$executeRaw`TRUNCATE TABLE api_keys`;
  await prisma.$executeRaw`TRUNCATE TABLE role_permissions`;
  await prisma.$executeRaw`TRUNCATE TABLE users`;
  await prisma.$executeRaw`TRUNCATE TABLE feature_flags`;
  await prisma.$executeRaw`TRUNCATE TABLE changelog`;
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;

  // Re-seed the three default feature flags
  await prisma.$executeRaw`
    INSERT INTO feature_flags (\`key\`, enabled, label, description) VALUES
    ('signup',    1, 'Sign Up',          'Allow new users to register an account'),
    ('dashboard', 1, 'Dashboard',        'Show the dashboard page in the navigation'),
    ('menu',      1, 'Navigation Menu',  'Show navigation links in the sidebar')
  `;
});
```

- [ ] **Step 3: Create src/test/helpers.ts**

```typescript
// src/test/helpers.ts
import { vi } from "vitest";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { hashPassword } from "@/lib/initDb";
import type { JwtPayload } from "@/lib/auth";

export interface TestUser {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  password: string;
}

export async function makeUser(
  overrides: Partial<{
    email: string;
    name: string;
    role: string;
    status: string;
    password: string;
  }> = {}
): Promise<TestUser> {
  const password = overrides.password ?? "password123";
  const email =
    overrides.email ??
    `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const name = overrides.name ?? "Test User";
  const role = overrides.role ?? "user";
  const status = overrides.status ?? "approved";
  const hash = await hashPassword(password);

  await prisma.$executeRaw`
    INSERT INTO users (email, password_hash, name, role, status, theme, created_at, updated_at)
    VALUES (${email}, ${hash}, ${name}, ${role}, ${status}, 'light', NOW(), NOW())
  `;
  const [row] = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  return { id: row.id, email, name, role, status, password };
}

export async function makeAdmin(
  overrides: Partial<{ email: string; name: string; password: string }> = {}
): Promise<TestUser> {
  return makeUser({ role: "admin", status: "approved", ...overrides });
}

export async function makeToken(payload: JwtPayload): Promise<string> {
  return signToken(payload);
}

export function mockAuth(token: string): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === "bp_token" ? { value: token } : undefined,
  } as any);
  vi.mocked(headers).mockResolvedValue(new Headers() as any);
}

export function mockNoAuth(): void {
  vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);
  vi.mocked(headers).mockResolvedValue(new Headers() as any);
}

export function makeRequest(
  method: string,
  url: string,
  body?: unknown
): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function adminRequest(
  url: string,
  method = "GET",
  body?: unknown
): Promise<Request> {
  const admin = await makeAdmin();
  const token = await makeToken({
    sub: String(admin.id),
    email: admin.email,
    role: "admin",
    name: admin.name,
  });
  mockAuth(token);
  return makeRequest(method, url, body);
}

export async function userRequest(
  url: string,
  method = "GET",
  body?: unknown
): Promise<{ req: Request; user: TestUser }> {
  const user = await makeUser();
  const token = await makeToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name,
  });
  mockAuth(token);
  return { req: makeRequest(method, url, body), user };
}
```

- [ ] **Step 4: Create smoke test**

```typescript
// src/test/smoke.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("infrastructure", () => {
  it("connects to the test database", async () => {
    const [{ v }] = await prisma.$queryRaw<{ v: number }[]>`SELECT 1 AS v`;
    expect(v).toBe(1);
  });

  it("feature flags were seeded by beforeEach", async () => {
    const rows = await prisma.$queryRaw<{ key: string }[]>`
      SELECT \`key\` FROM feature_flags ORDER BY \`key\`
    `;
    expect(rows.map((r) => r.key)).toEqual(["dashboard", "menu", "signup"]);
  });
});
```

- [ ] **Step 5: Run smoke test and verify it passes**

```bash
npm test -- src/test/smoke.test.ts
```

Expected output:
```
✓ src/test/smoke.test.ts (2)
  ✓ infrastructure > connects to the test database
  ✓ infrastructure > feature flags were seeded by beforeEach
```

If you see `ECONNREFUSED` or credential errors, check `.env.test` and confirm the `boilerplate_test` schema exists on the RDS host.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts .env.test src/test/globalSetup.ts src/test/setup.ts src/test/helpers.ts src/test/smoke.test.ts package.json package-lock.json
git commit -m "Add Vitest infrastructure: config, setup, helpers, smoke test"
```

---

### Task 3: Lib tests

**Files:**
- Create: `src/test/lib/auth.test.ts`
- Create: `src/test/lib/audit.test.ts`
- Create: `src/test/lib/flags.test.ts`
- Create: `src/test/lib/initDb.test.ts`
- Delete: `src/test/smoke.test.ts`

**Interfaces:**
- Consumes: `makeUser`, `mockAuth`, `mockNoAuth` from `../helpers`

- [ ] **Step 1: Create src/test/lib/auth.test.ts**

```typescript
// src/test/lib/auth.test.ts
import { describe, it, expect } from "vitest";
import { signToken, verifyToken, getSession } from "@/lib/auth";
import { makeToken, mockAuth, mockNoAuth, makeUser, makeAdmin } from "../helpers";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

describe("signToken / verifyToken", () => {
  it("round-trips a payload", async () => {
    const payload = { sub: "1", email: "a@test.com", role: "admin", name: "Alice" };
    const token = await signToken(payload);
    expect(typeof token).toBe("string");
    const decoded = await verifyToken(token);
    expect(decoded?.sub).toBe("1");
    expect(decoded?.email).toBe("a@test.com");
    expect(decoded?.role).toBe("admin");
    expect(decoded?.name).toBe("Alice");
  });

  it("returns null for a tampered token", async () => {
    const token = await signToken({ sub: "1", email: "a@test.com", role: "user", name: null });
    expect(await verifyToken(token + "x")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await verifyToken("")).toBeNull();
  });
});

describe("getSession — cookie path", () => {
  it("returns null when no cookie is set", async () => {
    // beforeEach already sets mockNoAuth
    expect(await getSession()).toBeNull();
  });

  it("returns payload when a valid bp_token cookie is present", async () => {
    const token = await makeToken({ sub: "42", email: "b@test.com", role: "admin", name: "Bob" });
    mockAuth(token);
    const session = await getSession();
    expect(session?.sub).toBe("42");
    expect(session?.email).toBe("b@test.com");
    expect(session?.role).toBe("admin");
  });

  it("returns null when the cookie contains an invalid token", async () => {
    mockAuth("not.a.valid.jwt");
    expect(await getSession()).toBeNull();
  });
});

describe("getSession — API key path", () => {
  it("returns admin session for an active unexpired key and updates last_used", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "a".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);

    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Test Key', 'test@test.com', ${admin.id}, NOW(), 1)
    `;

    // Pass the key via Authorization: Bearer header
    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: `Bearer ${rawKey}` }) as any
    );
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    const session = await getSession();
    expect(session?.role).toBe("admin");
    expect(session?.sub).toBe("apikey");

    // last_used should be set (eventually, it's fire-and-forget — wait briefly)
    await new Promise((r) => setTimeout(r, 100));
    const [row] = await prisma.$queryRaw<{ last_used: Date | null }[]>`
      SELECT last_used FROM api_keys WHERE prefix = ${prefix}
    `;
    expect(row.last_used).not.toBeNull();
  });

  it("returns null for a revoked API key", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "b".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);

    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Revoked Key', 'test@test.com', ${admin.id}, NOW(), 0)
    `;

    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: `Bearer ${rawKey}` }) as any
    );
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    expect(await getSession()).toBeNull();
  });

  it("returns null for an expired API key", async () => {
    const admin = await makeAdmin();
    const rawKey = "bp_" + "c".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    const past = new Date(Date.now() - 1000);

    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, expires_at, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Expired Key', 'test@test.com', ${past}, ${admin.id}, NOW(), 1)
    `;

    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: `Bearer ${rawKey}` }) as any
    );
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    expect(await getSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Create src/test/lib/audit.test.ts**

```typescript
// src/test/lib/audit.test.ts
import { describe, it, expect, vi } from "vitest";
import { auditLog, getIp } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

describe("auditLog", () => {
  it("inserts a row with the correct action and resource", async () => {
    await auditLog({ action: "TEST_ACTION", resource: "test_resource" });

    const rows = await prisma.$queryRaw<{ action: string; resource: string }[]>`
      SELECT action, resource FROM audit_logs LIMIT 1
    `;
    expect(rows[0].action).toBe("TEST_ACTION");
    expect(rows[0].resource).toBe("test_resource");
  });

  it("never throws even when the DB call fails", async () => {
    vi.spyOn(prisma, "$executeRaw").mockRejectedValueOnce(new Error("DB error"));
    await expect(
      auditLog({ action: "FAIL_ACTION", resource: "test" })
    ).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});

describe("getIp", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getIp(req as any)).toBe("1.2.3.4");
  });

  it("returns null when the header is absent", () => {
    const req = new Request("http://localhost/");
    expect(getIp(req as any)).toBeNull();
  });
});
```

- [ ] **Step 3: Create src/test/lib/flags.test.ts**

```typescript
// src/test/lib/flags.test.ts
import { describe, it, expect } from "vitest";
import { isFlagEnabled } from "@/lib/flags";
import { prisma } from "@/lib/prisma";

describe("isFlagEnabled", () => {
  it("returns true for a flag that is enabled", async () => {
    // 'signup' is seeded as enabled in beforeEach
    expect(await isFlagEnabled("signup")).toBe(true);
  });

  it("returns false for a flag that is disabled", async () => {
    await prisma.$executeRaw`UPDATE feature_flags SET enabled = 0 WHERE \`key\` = 'signup'`;
    expect(await isFlagEnabled("signup")).toBe(false);
  });

  it("returns true (fail-open) for an unknown flag key", async () => {
    expect(await isFlagEnabled("nonexistent-flag")).toBe(true);
  });
});
```

- [ ] **Step 4: Create src/test/lib/initDb.test.ts**

```typescript
// src/test/lib/initDb.test.ts
import { describe, it, expect } from "vitest";
import { initDb, hashPassword, verifyPassword } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";

describe("initDb", () => {
  it("is idempotent — second call does not throw", async () => {
    // initialized flag is already true from beforeAll in setup.ts
    await expect(initDb()).resolves.toBeUndefined();
  });

  it("does not duplicate feature flags when called again", async () => {
    await initDb(); // no-op due to initialized flag
    const [{ cnt }] = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM feature_flags
    `;
    expect(Number(cnt)).toBe(3);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("produces a hash that is not the plaintext", async () => {
    const hash = await hashPassword("mysecret");
    expect(hash).not.toBe("mysecret");
    expect(hash.startsWith("$2b$")).toBe(true);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 5: Delete smoke test and run lib tests**

```bash
# Delete the temporary smoke test
rm src/test/smoke.test.ts

npm test -- src/test/lib/
```

Expected:
```
✓ src/test/lib/auth.test.ts (7)
✓ src/test/lib/audit.test.ts (3)
✓ src/test/lib/flags.test.ts (3)
✓ src/test/lib/initDb.test.ts (5)
Test Files  4 passed
Tests      18 passed
```

- [ ] **Step 6: Commit**

```bash
git add src/test/lib/ && git rm src/test/smoke.test.ts
git commit -m "Add lib layer tests: auth, audit, flags, initDb"
```

---

### Task 4: Auth API tests

**Files:**
- Create: `src/test/api/auth.test.ts`

**Interfaces:**
- Consumes: `makeUser`, `makeRequest`, `adminRequest` from `../helpers`
- Consumes route handlers: `POST` from `@/app/api/auth/login/route`, `@/app/api/auth/logout/route`, `@/app/api/auth/signup/route`

- [ ] **Step 1: Create src/test/api/auth.test.ts**

```typescript
// src/test/api/auth.test.ts
import { describe, it, expect } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { makeUser, makeRequest, mockAuth, makeToken } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── Login ──────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("returns 200 and sets bp_token cookie on valid credentials", async () => {
    const user = await makeUser({ status: "approved" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    const res = await login(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("bp_token=");
  });

  it("returns 401 for a wrong password", async () => {
    const user = await makeUser({ status: "approved" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: "wrongpassword",
    });
    const res = await login(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown email", async () => {
    const req = makeRequest("POST", "/api/auth/login", {
      email: "nobody@test.com",
      password: "password123",
    });
    const res = await login(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a pending user", async () => {
    const user = await makeUser({ status: "pending" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    const res = await login(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a rejected user", async () => {
    const user = await makeUser({ status: "rejected" });
    const req = makeRequest("POST", "/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    const res = await login(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 400 when email or password is missing", async () => {
    const req = makeRequest("POST", "/api/auth/login", { email: "x@test.com" });
    const res = await login(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── Logout ─────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("returns 200 and clears bp_token cookie", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("POST", "/api/auth/logout");
    const res = await logout(req as any);
    expect(res.status).toBe(200);
    // Cookie should be cleared (maxAge=0)
    expect(res.headers.get("set-cookie")).toContain("bp_token=;");
  });

  it("returns 200 even when unauthenticated", async () => {
    // mockNoAuth is set by beforeEach
    const req = makeRequest("POST", "/api/auth/logout");
    const res = await logout(req as any);
    expect(res.status).toBe(200);
  });
});

// ─── Signup ─────────────────────────────────────────────────
describe("POST /api/auth/signup", () => {
  it("returns 200 and creates a pending user", async () => {
    const req = makeRequest("POST", "/api/auth/signup", {
      email: "newuser@test.com",
      password: "password123",
      name: "New User",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(200);

    const rows = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM users WHERE email = 'newuser@test.com' LIMIT 1
    `;
    expect(rows[0].status).toBe("pending");
  });

  it("returns 423 when signup flag is disabled", async () => {
    await prisma.$executeRaw`UPDATE feature_flags SET enabled = 0 WHERE \`key\` = 'signup'`;
    const req = makeRequest("POST", "/api/auth/signup", {
      email: "blocked@test.com",
      password: "password123",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(423);
  });

  it("returns 409 for a duplicate email", async () => {
    const user = await makeUser({ email: "existing@test.com" });
    const req = makeRequest("POST", "/api/auth/signup", {
      email: user.email,
      password: "password123",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(409);
  });

  it("returns 400 when password is under 8 characters", async () => {
    const req = makeRequest("POST", "/api/auth/signup", {
      email: "short@test.com",
      password: "abc",
    });
    const res = await signup(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = makeRequest("POST", "/api/auth/signup", { password: "password123" });
    const res = await signup(req as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run auth API tests**

```bash
npm test -- src/test/api/auth.test.ts
```

Expected:
```
✓ src/test/api/auth.test.ts (13)
Test Files  1 passed
Tests      13 passed
```

- [ ] **Step 3: Commit**

```bash
git add src/test/api/auth.test.ts
git commit -m "Add auth API route tests (login, logout, signup)"
```

---

### Task 5: Users API tests

**Files:**
- Create: `src/test/api/users.test.ts`

**Interfaces:**
- Consumes route handlers: `GET` from `@/app/api/users/route`; `PATCH`, `DELETE` from `@/app/api/users/[id]/route`

- [ ] **Step 1: Create src/test/api/users.test.ts**

```typescript
// src/test/api/users.test.ts
import { describe, it, expect } from "vitest";
import { GET as getUsers } from "@/app/api/users/route";
import { PATCH as patchUser, DELETE as deleteUser } from "@/app/api/users/[id]/route";
import { makeUser, makeAdmin, makeRequest, adminRequest, userRequest, makeToken, mockAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── GET /api/users ──────────────────────────────────────────
describe("GET /api/users", () => {
  it("returns 200 with a user array for admin", async () => {
    await makeUser();
    await makeUser();
    const req = await adminRequest("/api/users");
    const res = await getUsers();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body[0]).toHaveProperty("email");
    expect(body[0]).toHaveProperty("status");
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/users");
    const res = await getUsers();
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const res = await getUsers();
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/users/[id] ───────────────────────────────────
describe("PATCH /api/users/[id]", () => {
  it("approves a pending user", async () => {
    const pending = await makeUser({ status: "pending" });
    const req = await adminRequest(`/api/users/${pending.id}`, "PATCH", { status: "approved" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(pending.id) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM users WHERE id = ${pending.id}
    `;
    expect(row.status).toBe("approved");
  });

  it("changes the role of a user", async () => {
    const user = await makeUser();
    const req = await adminRequest(`/api/users/${user.id}`, "PATCH", { role: "admin" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(user.id) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ role: string }[]>`
      SELECT role FROM users WHERE id = ${user.id}
    `;
    expect(row.role).toBe("admin");
  });

  it("returns 400 when trying to modify own account", async () => {
    const admin = await makeAdmin();
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/users/${admin.id}`, { status: "rejected" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(admin.id) }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const target = await makeUser();
    const { req } = await userRequest(`/api/users/${target.id}`, "PATCH", { status: "approved" });
    const res = await patchUser(req as any, { params: Promise.resolve({ id: String(target.id) }) });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/users/[id] ──────────────────────────────────
describe("DELETE /api/users/[id]", () => {
  it("deletes another user", async () => {
    const target = await makeUser();
    const req = await adminRequest(`/api/users/${target.id}`, "DELETE");
    const res = await deleteUser(req as any, { params: Promise.resolve({ id: String(target.id) }) });
    expect(res.status).toBe(200);

    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM users WHERE id = ${target.id}`;
    expect(rows.length).toBe(0);
  });

  it("returns 400 when trying to delete own account", async () => {
    const admin = await makeAdmin();
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("DELETE", `/api/users/${admin.id}`);
    const res = await deleteUser(req as any, { params: Promise.resolve({ id: String(admin.id) }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const target = await makeUser();
    const { req } = await userRequest(`/api/users/${target.id}`, "DELETE");
    const res = await deleteUser(req as any, { params: Promise.resolve({ id: String(target.id) }) });
    expect(res.status).toBe(403);
  });
});
```

Note: `userRequest` is imported but defined in helpers — add this export to `src/test/helpers.ts` if not already present (it was included in Task 2 Step 3).

- [ ] **Step 2: Run users tests**

```bash
npm test -- src/test/api/users.test.ts
```

Expected:
```
✓ src/test/api/users.test.ts (9)
Test Files  1 passed
Tests       9 passed
```

- [ ] **Step 3: Commit**

```bash
git add src/test/api/users.test.ts
git commit -m "Add users API route tests (list, patch, delete)"
```

---

### Task 6: Profile and theme API tests

**Files:**
- Create: `src/test/api/me.test.ts`

**Interfaces:**
- Consumes route handlers: `GET`, `PATCH` from `@/app/api/me/profile/route`; `PATCH` from `@/app/api/me/theme/route`

- [ ] **Step 1: Create src/test/api/me.test.ts**

```typescript
// src/test/api/me.test.ts
import { describe, it, expect } from "vitest";
import { GET as getProfile, PATCH as patchProfile } from "@/app/api/me/profile/route";
import { PATCH as patchTheme } from "@/app/api/me/theme/route";
import { makeUser, makeRequest, makeToken, mockAuth, mockNoAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── GET /api/me/profile ─────────────────────────────────────
describe("GET /api/me/profile", () => {
  it("returns id, name, email, avatar for authenticated user", async () => {
    const user = await makeUser({ name: "Alice" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const res = await getProfile();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.id);
    expect(body.email).toBe(user.email);
    expect(body.name).toBe("Alice");
    expect("avatar" in body).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getProfile();
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/me/profile — identity ────────────────────────
describe("PATCH /api/me/profile — identity fields", () => {
  it("updates name and re-issues a JWT cookie", async () => {
    const user = await makeUser({ name: "Old Name" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", { name: "New Name" });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bp_token=");

    const [row] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM users WHERE id = ${user.id}
    `;
    expect(row.name).toBe("New Name");
  });

  it("sets a valid avatar (1–127)", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", { avatar: 42 });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ avatar: number }[]>`
      SELECT avatar FROM users WHERE id = ${user.id}
    `;
    expect(row.avatar).toBe(42);
  });

  it("returns 400 when avatar is out of range", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    // avatar 200 is out of range (max 127)
    const req = makeRequest("PATCH", "/api/me/profile", { avatar: 200 });
    const res = await patchProfile(req as any);
    // out-of-range avatar is silently skipped, leaving 0 updates → 400
    expect(res.status).toBe(400);
  });

  it("returns 400 when body has nothing to update", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", {});
    const res = await patchProfile(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/me/profile — password ────────────────────────
describe("PATCH /api/me/profile — password change", () => {
  it("changes the password when current password is correct", async () => {
    const user = await makeUser({ password: "oldpassword" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", {
      currentPassword: "oldpassword",
      newPassword: "newpassword123",
    });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(200);

    // Verify new password hash is stored
    const [row] = await prisma.$queryRaw<{ password_hash: string }[]>`
      SELECT password_hash FROM users WHERE id = ${user.id}
    `;
    const { verifyPassword } = await import("@/lib/initDb");
    expect(await verifyPassword("newpassword123", row.password_hash)).toBe(true);
    expect(await verifyPassword("oldpassword", row.password_hash)).toBe(false);
  });

  it("returns 400 when current password is wrong", async () => {
    const user = await makeUser({ password: "correctpassword" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", {
      currentPassword: "wrongpassword",
      newPassword: "newpassword123",
    });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is provided without currentPassword", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/profile", { newPassword: "newpassword123" });
    const res = await patchProfile(req as any);
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/me/theme ─────────────────────────────────────
describe("PATCH /api/me/theme", () => {
  it("sets theme to dark and sets bp_theme cookie", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "dark" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bp_theme=dark");
  });

  it("sets theme to light", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "light" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bp_theme=light");
  });

  it("returns 400 for an invalid theme value", async () => {
    const user = await makeUser();
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "solarized" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const req = makeRequest("PATCH", "/api/me/theme", { theme: "dark" });
    const res = await patchTheme(req as any);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run profile/theme tests**

```bash
npm test -- src/test/api/me.test.ts
```

Expected:
```
✓ src/test/api/me.test.ts (12)
Test Files  1 passed
Tests      12 passed
```

- [ ] **Step 3: Commit**

```bash
git add src/test/api/me.test.ts
git commit -m "Add profile and theme API route tests"
```

---

### Task 7: Dashboard and overview API tests

**Files:**
- Create: `src/test/api/dashboard.test.ts`

**Interfaces:**
- Consumes route handlers: `GET` from `@/app/api/dashboard/route`; `GET` from `@/app/api/settings/overview/route`

- [ ] **Step 1: Create src/test/api/dashboard.test.ts**

```typescript
// src/test/api/dashboard.test.ts
import { describe, it, expect } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getOverview } from "@/app/api/settings/overview/route";
import { makeUser, makeAdmin, makeToken, mockAuth, userRequest, adminRequest } from "../helpers";

// ─── GET /api/dashboard ──────────────────────────────────────
describe("GET /api/dashboard", () => {
  it("returns stats and recentUsers for any authenticated user", async () => {
    await makeUser();
    await makeUser({ status: "pending" });
    const { req } = await userRequest("/api/dashboard");
    const res = await getDashboard();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalUsers).toBe("number");
    expect(typeof body.pendingUsers).toBe("number");
    expect(typeof body.approvedUsers).toBe("number");
    expect(typeof body.auditCount).toBe("number");
    expect(Array.isArray(body.recentUsers)).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getDashboard();
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/settings/overview ─────────────────────────────
describe("GET /api/settings/overview", () => {
  it("returns full overview stats for admin", async () => {
    await makeUser();
    const req = await adminRequest("/api/settings/overview");
    const res = await getOverview();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalUsers).toBe("number");
    expect(typeof body.pendingUsers).toBe("number");
    expect(typeof body.auditEvents).toBe("number");
    expect(Array.isArray(body.newUsers)).toBe(true);
    expect(Array.isArray(body.recentAudit)).toBe(true);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/settings/overview");
    const res = await getOverview();
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const res = await getOverview();
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run dashboard tests**

```bash
npm test -- src/test/api/dashboard.test.ts
```

Expected:
```
✓ src/test/api/dashboard.test.ts (5)
Test Files  1 passed
Tests       5 passed
```

- [ ] **Step 3: Commit**

```bash
git add src/test/api/dashboard.test.ts
git commit -m "Add dashboard and overview API route tests"
```

---

### Task 8: Audit log and feature flags API tests

**Files:**
- Create: `src/test/api/audit.test.ts`
- Create: `src/test/api/feature-flags.test.ts`

**Interfaces:**
- Consumes route handlers: `GET` from `@/app/api/audit/route`; `GET` from `@/app/api/feature-flags/route`; `PATCH` from `@/app/api/feature-flags/[key]/route`

- [ ] **Step 1: Create src/test/api/audit.test.ts**

```typescript
// src/test/api/audit.test.ts
import { describe, it, expect } from "vitest";
import { GET as getAudit } from "@/app/api/audit/route";
import { makeUser, makeRequest, adminRequest, userRequest } from "../helpers";
import { auditLog } from "@/lib/audit";

describe("GET /api/audit", () => {
  it("returns paginated rows and total for admin", async () => {
    await auditLog({ action: "LOGIN", resource: "sessions" });
    await auditLog({ action: "LOGOUT", resource: "sessions" });
    const req = await adminRequest("/api/audit?page=1&limit=10");
    const res = await getAudit(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rows)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
  });

  it("filters rows by action", async () => {
    await auditLog({ action: "LOGIN", resource: "sessions" });
    await auditLog({ action: "SIGNUP", resource: "users" });
    const req = await adminRequest("/api/audit?action=SIGNUP");
    const res = await getAudit(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.every((r: any) => r.action === "SIGNUP")).toBe(true);
  });

  it("respects page and limit params", async () => {
    for (let i = 0; i < 5; i++) {
      await auditLog({ action: "TEST", resource: "test" });
    }
    const req = await adminRequest("/api/audit?page=1&limit=2");
    const res = await getAudit(req as any);
    const body = await res.json();
    expect(body.rows.length).toBeLessThanOrEqual(2);
    expect(body.limit).toBe(2);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/audit");
    const res = await getAudit(req as any);
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const req = makeRequest("GET", "/api/audit");
    const res = await getAudit(req as any);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Create src/test/api/feature-flags.test.ts**

```typescript
// src/test/api/feature-flags.test.ts
import { describe, it, expect } from "vitest";
import { GET as getFlags } from "@/app/api/feature-flags/route";
import { PATCH as patchFlag } from "@/app/api/feature-flags/[key]/route";
import { makeRequest, adminRequest, userRequest } from "../helpers";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

describe("GET /api/feature-flags", () => {
  it("returns an object keyed by flag key for any authenticated user", async () => {
    const { req } = await userRequest("/api/feature-flags");
    const res = await getFlags();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body.signup).toHaveProperty("enabled");
    expect(body.signup).toHaveProperty("label");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getFlags();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/feature-flags/[key]", () => {
  it("toggles a flag off and writes an audit log entry", async () => {
    const req = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ enabled: number }[]>`
      SELECT enabled FROM feature_flags WHERE \`key\` = 'signup'
    `;
    expect(row.enabled).toBe(0);

    const auditRows = await prisma.$queryRaw<{ action: string }[]>`
      SELECT action FROM audit_logs WHERE action = 'FEATURE_FLAG_UPDATED' LIMIT 1
    `;
    expect(auditRows.length).toBe(1);
  });

  it("toggles a flag back on", async () => {
    // First disable it
    await prisma.$executeRaw`UPDATE feature_flags SET enabled = 0 WHERE \`key\` = 'dashboard'`;
    const req = await adminRequest("/api/feature-flags/dashboard", "PATCH", { enabled: true });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "dashboard" }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ enabled: number }[]>`
      SELECT enabled FROM feature_flags WHERE \`key\` = 'dashboard'
    `;
    expect(row.enabled).toBe(1);
  });

  it("returns 404 when the flag key does not exist", async () => {
    const req = await adminRequest("/api/feature-flags/nonexistent", "PATCH", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when enabled is not a boolean", async () => {
    const req = await adminRequest("/api/feature-flags/signup", "PATCH", { enabled: "yes" });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/feature-flags/signup", "PATCH", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    const req = makeRequest("PATCH", "/api/feature-flags/signup", { enabled: false });
    const res = await patchFlag(req as any, { params: Promise.resolve({ key: "signup" }) });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run audit + feature-flags tests**

```bash
npm test -- src/test/api/audit.test.ts src/test/api/feature-flags.test.ts
```

Expected:
```
✓ src/test/api/audit.test.ts (5)
✓ src/test/api/feature-flags.test.ts (7)
Test Files  2 passed
Tests      12 passed
```

- [ ] **Step 4: Commit**

```bash
git add src/test/api/audit.test.ts src/test/api/feature-flags.test.ts
git commit -m "Add audit log and feature flags API route tests"
```

---

### Task 9: API keys tests

**Files:**
- Create: `src/test/api/api-keys.test.ts`

**Interfaces:**
- Consumes route handlers: `GET`, `POST` from `@/app/api/api-keys/route`; `PATCH`, `DELETE` from `@/app/api/api-keys/[id]/route`

- [ ] **Step 1: Create src/test/api/api-keys.test.ts**

```typescript
// src/test/api/api-keys.test.ts
import { describe, it, expect } from "vitest";
import { GET as getKeys, POST as createKey } from "@/app/api/api-keys/route";
import { PATCH as patchKey, DELETE as deleteKey } from "@/app/api/api-keys/[id]/route";
import { makeRequest, adminRequest, userRequest } from "../helpers";
import { prisma } from "@/lib/prisma";

// ─── GET /api/api-keys ───────────────────────────────────────
describe("GET /api/api-keys", () => {
  it("returns an array of key metadata for admin", async () => {
    await adminRequest("/api/api-keys");
    const res = await getKeys();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/api-keys");
    const res = await getKeys();
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getKeys();
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/api-keys ──────────────────────────────────────
describe("POST /api/api-keys", () => {
  it("creates a key and returns raw key with prefix; raw key is not stored", async () => {
    const req = await adminRequest("/api/api-keys", "POST", {
      name: "Test Key",
      contact: "dev@test.com",
    });
    const res = await createKey(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.key).toMatch(/^bp_[a-f0-9]{32}$/);
    expect(body.prefix).toBe(body.key.slice(0, 12));

    // Verify raw key is not in DB — only hash
    const rows = await prisma.$queryRaw<{ key_hash: string }[]>`
      SELECT key_hash FROM api_keys WHERE prefix = ${body.prefix}
    `;
    expect(rows[0].key_hash).not.toBe(body.key);
    expect(rows[0].key_hash).toHaveLength(64); // SHA256 hex
  });

  it("returns 400 when name is missing", async () => {
    const req = await adminRequest("/api/api-keys", "POST", { contact: "dev@test.com" });
    const res = await createKey(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when contact is missing", async () => {
    const req = await adminRequest("/api/api-keys", "POST", { name: "Test Key" });
    const res = await createKey(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/api-keys", "POST", { name: "k", contact: "c" });
    const res = await createKey(req as any);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/api-keys/[id] ────────────────────────────────
describe("PATCH /api/api-keys/[id]", () => {
  async function seedKey(adminId: number): Promise<number> {
    const { createHash } = await import("crypto");
    const rawKey = "bp_" + "d".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Seed Key', 'seed@test.com', ${adminId}, NOW(), 1)
    `;
    const [row] = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM api_keys WHERE prefix = ${prefix}
    `;
    return row.id;
  }

  it("revokes an active key (active → false)", async () => {
    const admin = await (await import("../helpers")).makeAdmin();
    const keyId = await seedKey(admin.id);
    const { makeToken, mockAuth } = await import("../helpers");
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/api-keys/${keyId}`, { active: false });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ active: number }[]>`
      SELECT active FROM api_keys WHERE id = ${keyId}
    `;
    expect(row.active).toBe(0);
  });

  it("re-enables a revoked key (active → true)", async () => {
    const admin = await (await import("../helpers")).makeAdmin();
    const keyId = await seedKey(admin.id);
    await prisma.$executeRaw`UPDATE api_keys SET active = 0 WHERE id = ${keyId}`;
    const { makeToken, mockAuth } = await import("../helpers");
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("PATCH", `/api/api-keys/${keyId}`, { active: true });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(200);

    const [row] = await prisma.$queryRaw<{ active: number }[]>`
      SELECT active FROM api_keys WHERE id = ${keyId}
    `;
    expect(row.active).toBe(1);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/api-keys/1", "PATCH", { active: false });
    const res = await patchKey(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/api-keys/[id] ───────────────────────────────
describe("DELETE /api/api-keys/[id]", () => {
  it("deletes an API key", async () => {
    const { makeAdmin, makeToken, mockAuth } = await import("../helpers");
    const { createHash } = await import("crypto");
    const admin = await makeAdmin();
    const rawKey = "bp_" + "e".repeat(32);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);
    await prisma.$executeRaw`
      INSERT INTO api_keys (key_hash, prefix, name, contact, created_by, created_at, active)
      VALUES (${keyHash}, ${prefix}, 'Del Key', 'del@test.com', ${admin.id}, NOW(), 1)
    `;
    const [row] = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM api_keys WHERE prefix = ${prefix}`;
    const keyId = row.id;

    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const req = makeRequest("DELETE", `/api/api-keys/${keyId}`);
    const res = await deleteKey(req as any, { params: Promise.resolve({ id: String(keyId) }) });
    expect(res.status).toBe(200);

    const remaining = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM api_keys WHERE id = ${keyId}`;
    expect(remaining.length).toBe(0);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/api-keys/1", "DELETE");
    const res = await deleteKey(req as any, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run api-keys tests**

```bash
npm test -- src/test/api/api-keys.test.ts
```

Expected:
```
✓ src/test/api/api-keys.test.ts (10)
Test Files  1 passed
Tests      10 passed
```

- [ ] **Step 3: Commit**

```bash
git add src/test/api/api-keys.test.ts
git commit -m "Add API keys route tests (list, create, revoke, delete)"
```

---

### Task 10: RBAC, misc, and middleware tests

**Files:**
- Create: `src/test/api/rbac.test.ts`
- Create: `src/test/api/misc.test.ts`
- Create: `src/test/middleware.test.ts`

**Interfaces:**
- Consumes route handlers: `GET`, `PUT` from `@/app/api/rbac/route`; `GET` from `@/app/api/rbac/me/route`; `GET` from `@/app/api/changelog/route`; `GET` from `@/app/api/openapi/route`
- Consumes: `middleware` from `@/middleware`

- [ ] **Step 1: Create src/test/api/rbac.test.ts**

```typescript
// src/test/api/rbac.test.ts
import { describe, it, expect } from "vitest";
import { GET as getRbac, PUT as putRbac } from "@/app/api/rbac/route";
import { GET as getMyRbac } from "@/app/api/rbac/me/route";
import { makeUser, makeRequest, adminRequest, userRequest, makeToken, mockAuth } from "../helpers";
import { prisma } from "@/lib/prisma";

describe("GET /api/rbac", () => {
  it("returns full permissions matrix for admin", async () => {
    // Seed some permissions
    await prisma.$executeRaw`INSERT INTO role_permissions (role, nav_key) VALUES ('admin', 'dashboard'), ('viewer', 'dashboard')`;
    const req = await adminRequest("/api/rbac");
    const res = await getRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.admin)).toBe(true);
    expect(Array.isArray(body.viewer)).toBe(true);
    expect(Array.isArray(body.editor)).toBe(true);
  });

  it("returns 403 for a non-admin user", async () => {
    await userRequest("/api/rbac");
    const res = await getRbac();
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getRbac();
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/rbac", () => {
  it("replaces all permissions and writes an audit log", async () => {
    const req = await adminRequest("/api/rbac", "PUT", {
      viewer: ["dashboard"],
      editor: ["dashboard", "settings"],
      admin: ["dashboard", "settings"],
    });
    const res = await putRbac(req as any);
    expect(res.status).toBe(200);

    const rows = await prisma.$queryRaw<{ role: string; nav_key: string }[]>`
      SELECT role, nav_key FROM role_permissions ORDER BY role, nav_key
    `;
    const adminKeys = rows.filter((r) => r.role === "admin").map((r) => r.nav_key).sort();
    expect(adminKeys).toEqual(["dashboard", "settings"]);

    const auditRows = await prisma.$queryRaw<{ action: string }[]>`
      SELECT action FROM audit_logs WHERE action = 'RBAC_UPDATED' LIMIT 1
    `;
    expect(auditRows.length).toBe(1);
  });

  it("returns 403 for a non-admin user", async () => {
    const { req } = await userRequest("/api/rbac", "PUT", { viewer: [] });
    const res = await putRbac(req as any);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/rbac/me", () => {
  it("returns viewer nav keys for a user with role=user (legacy mapping)", async () => {
    await prisma.$executeRaw`INSERT INTO role_permissions (role, nav_key) VALUES ('viewer', 'dashboard')`;
    const user = await makeUser({ role: "user" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const res = await getMyRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("viewer");
    expect(body.navKeys).toContain("dashboard");
  });

  it("returns admin nav keys for an admin", async () => {
    await prisma.$executeRaw`INSERT INTO role_permissions (role, nav_key) VALUES ('admin', 'dashboard'), ('admin', 'settings')`;
    const admin = await makeUser({ role: "admin" });
    const token = await makeToken({ sub: String(admin.id), email: admin.email, role: "admin", name: admin.name });
    mockAuth(token);
    const res = await getMyRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
    expect(body.navKeys).toContain("dashboard");
  });

  it("falls back to DEFAULT_ROLE_PERMISSIONS when role_permissions table is empty", async () => {
    // Table is empty after beforeEach truncate
    const user = await makeUser({ role: "user" });
    const token = await makeToken({ sub: String(user.id), email: user.email, role: "user", name: user.name });
    mockAuth(token);
    const res = await getMyRbac();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.navKeys).toContain("dashboard");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getMyRbac();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Create src/test/api/misc.test.ts**

```typescript
// src/test/api/misc.test.ts
import { describe, it, expect } from "vitest";
import { GET as getChangelog } from "@/app/api/changelog/route";
import { GET as getOpenApi } from "@/app/api/openapi/route";
import { adminRequest, userRequest } from "../helpers";
import { prisma } from "@/lib/prisma";

describe("GET /api/changelog", () => {
  it("returns changelog entries ordered by date DESC for authenticated user", async () => {
    await prisma.$executeRaw`
      INSERT INTO changelog (date, description) VALUES
      ('2026-01-01', 'First entry'),
      ('2026-06-01', 'Second entry')
    `;
    const { req } = await userRequest("/api/changelog");
    const res = await getChangelog();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    // Most recent first
    expect(body[0].date >= body[1].date).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getChangelog();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/openapi", () => {
  it("returns a spec with openapi and paths keys for authenticated user", async () => {
    const { req } = await userRequest("/api/openapi");
    const res = await getOpenApi();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toMatch(/^3\./);
    expect(typeof body.paths).toBe("object");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getOpenApi();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Create src/test/middleware.test.ts**

```typescript
// src/test/middleware.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signToken } from "@/lib/auth";

function req(path: string, token?: string): NextRequest {
  const url = `http://localhost${path}`;
  const headers: Record<string, string> = {};
  if (token) headers["cookie"] = `bp_token=${token}`;
  return new NextRequest(url, { headers });
}

describe("middleware", () => {
  it("passes /login through without a token", async () => {
    const res = await middleware(req("/login"));
    // NextResponse.next() has no Location header
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes /api/auth/login through without a token", async () => {
    const res = await middleware(req("/api/auth/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes /api/auth/signup through without a token", async () => {
    const res = await middleware(req("/api/auth/signup"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes a protected page through when a valid token is present", async () => {
    const token = await signToken({ sub: "1", email: "u@test.com", role: "user", name: null });
    const res = await middleware(req("/", token));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects to /login for a protected page with no token", async () => {
    const res = await middleware(req("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects to /login for a protected page with a tampered token", async () => {
    const res = await middleware(req("/", "bad.token.value"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 JSON for a protected API route with no token", async () => {
    const res = await middleware(req("/api/users"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("passes a protected API route through when a valid token is present", async () => {
    const token = await signToken({ sub: "1", email: "u@test.com", role: "admin", name: null });
    const res = await middleware(req("/api/users", token));
    expect(res.headers.get("location")).toBeNull();
  });
});
```

- [ ] **Step 4: Run RBAC, misc, and middleware tests**

```bash
npm test -- src/test/api/rbac.test.ts src/test/api/misc.test.ts src/test/middleware.test.ts
```

Expected:
```
✓ src/test/api/rbac.test.ts (7)
✓ src/test/api/misc.test.ts (4)
✓ src/test/middleware.test.ts (8)
Test Files  3 passed
Tests      19 passed
```

- [ ] **Step 5: Run the full suite and check coverage**

```bash
npm test
```

Expected summary:
```
Test Files  13 passed
Tests      ~105 passed
```

```bash
npm run test:coverage
```

Check the text output. Target: >90% line coverage on `src/lib/` and `src/app/api/`.

- [ ] **Step 6: Commit**

```bash
git add src/test/api/rbac.test.ts src/test/api/misc.test.ts src/test/middleware.test.ts
git commit -m "Add RBAC, changelog, openapi, and middleware tests — full suite complete"
```

---

## Self-Review Notes

- `GET /api/users` returns 403 (not 401) for unauthenticated requests — the handler checks `session.role !== 'admin'` in a single guard where null session also fails; tests reflect this.
- `GET /api/audit` uses the same combined guard — tests assert 403, not 401, for unauthenticated calls.
- API key revoke/enable tests inline their own `seedKey` helper to avoid shared mutable state.
- Middleware tests use `NextRequest` directly (no `next/headers` mock needed — middleware reads cookies from the request object, not from the server context).
- `vi.mock('next/headers', ...)` in `setup.ts` applies globally to all test files via `setupFiles` — individual test files do not need to redeclare the mock.
