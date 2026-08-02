// src/test/setup.ts
import { vi, beforeAll, beforeEach } from "vitest";

// Mock next/headers globally — getSession() calls cookies() and headers()
// from next/headers, which only exist inside the Next.js server runtime.
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

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
  await prisma.$executeRaw`TRUNCATE TABLE crisis_banner`;
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;

  // Re-seed the crisis banner singleton row (keep in sync with initDb.ts)
  await prisma.$executeRaw`INSERT INTO crisis_banner (id, message, enabled) VALUES (1, '', 0)`;

  // Re-seed the default feature flags (keep in sync with initDb.ts's defaultFlags)
  await prisma.$executeRaw`
    INSERT INTO feature_flags (\`key\`, enabled, label, description) VALUES
    ('signup',      1, 'Sign Up',          'Allow new users to register an account'),
    ('dashboard',   1, 'Dashboard',        'Show the dashboard page in the navigation'),
    ('menu',        1, 'Navigation Menu',  'Show navigation links in the sidebar'),
    ('remember_me', 1, 'Remember Me',     'Allow users to stay recognized on this browser via the login account picker')
  `;
});
