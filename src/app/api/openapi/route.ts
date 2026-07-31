import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Boilerplate Admin API",
    version: "1.0.0",
    description: "REST API for the Boilerplate admin application.",
  },
  servers: [{ url: "/api", description: "Current server" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "bp_token",
        description: "JWT session cookie set on login",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id:         { type: "integer" },
          email:      { type: "string", format: "email" },
          name:       { type: "string", nullable: true },
          role:       { type: "string", enum: ["user", "admin"] },
          status:     { type: "string", enum: ["pending", "approved", "rejected"] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      AuditEntry: {
        type: "object",
        properties: {
          id:          { type: "integer" },
          action:      { type: "string" },
          resource:    { type: "string", nullable: true },
          resource_id: { type: "string", nullable: true },
          details:     { type: "string", nullable: true },
          ip:          { type: "string", nullable: true },
          created_at:  { type: "string", format: "date-time" },
          user_email:  { type: "string", nullable: true },
          user_name:   { type: "string", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    // ── Auth ────────────────────────────────────────────────────────────
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description: "Authenticates a user and sets `bp_token` + `bp_theme` cookies. If `rememberMe` is true and the `remember_me` feature flag is enabled, also adds the account to the `bp_remembered` multi-profile cookie used by the login page's account picker.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:      { type: "string", format: "email" },
                  password:   { type: "string" },
                  rememberMe: { type: "boolean", description: "Adds this account to the remembered-profiles cookie" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } },
          400: { description: "Missing fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          403: { description: "Account pending or rejected", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description: "Clears the session cookie. The `bp_remembered` multi-profile cookie is left untouched, so the account picker keeps showing on next visit to `/login`.",
        responses: {
          200: { description: "Logged out" },
        },
      },
    },
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Register a new account",
        description: "Creates a new user with `pending` status. Requires admin approval before login is allowed.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  name:     { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Account created, awaiting approval" },
          400: { description: "Validation error or duplicate email", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ── Me ──────────────────────────────────────────────────────────────
    "/me/theme": {
      patch: {
        tags: ["Me"],
        summary: "Update theme preference",
        description: "Saves dark/light preference to the database and refreshes the `bp_theme` cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["theme"], properties: { theme: { type: "string", enum: ["dark", "light"] } } },
            },
          },
        },
        responses: {
          200: { description: "Theme updated" },
          400: { description: "Invalid theme value" },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/me/profile": {
      get: {
        tags: ["Me"],
        summary: "Get own profile",
        description: "Returns the current user's name, email, avatar number (1–127; null means no avatar saved — caller should derive a default), and localisation preferences.",
        responses: {
          200: { description: "Profile data", content: { "application/json": { schema: { type: "object", properties: { name: { type: "string", nullable: true }, email: { type: "string" }, avatar: { type: "integer", nullable: true, minimum: 1, maximum: 127 }, language: { type: "string", nullable: true, description: "ISO 639-1 code, e.g. 'en'" }, timezone: { type: "string", nullable: true, description: "IANA timezone, e.g. 'Australia/Sydney'" }, country: { type: "string", nullable: true, description: "ISO 3166-1 alpha-2 code, e.g. 'AU'" }, currency: { type: "string", nullable: true, description: "ISO 4217 code, e.g. 'AUD'" } } } } } },
          401: { description: "Not authenticated" },
          404: { description: "User not found" },
        },
      },
      patch: {
        tags: ["Me"],
        summary: "Update own profile",
        description: "Update name, email, password, avatar, and/or localisation preferences for the currently logged-in user. Password change requires `currentPassword`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:            { type: "string", nullable: true },
                  email:           { type: "string", format: "email" },
                  currentPassword: { type: "string", description: "Required when changing password" },
                  newPassword:     { type: "string" },
                  avatar:          { type: "integer", minimum: 1, maximum: 127, description: "Avatar number (1–127); values outside this range are ignored" },
                  language:        { type: "string", nullable: true, description: "ISO 639-1 code, e.g. 'en'" },
                  timezone:        { type: "string", nullable: true, description: "IANA timezone, e.g. 'Australia/Sydney'" },
                  country:         { type: "string", nullable: true, description: "ISO 3166-1 alpha-2 code, e.g. 'AU'" },
                  currency:        { type: "string", nullable: true, description: "ISO 4217 code, e.g. 'AUD'" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Profile updated, new JWT cookie set", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, name: { type: "string", nullable: true }, email: { type: "string" } } } } } },
          400: { description: "Validation error or wrong current password" },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── Health ──────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Meta"],
        summary: "Health check",
        description: "Unauthenticated liveness/readiness check: verifies the server is responding, the database is reachable, and the expected core tables exist.",
        security: [],
        responses: {
          200: {
            description: "All checks passed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status:    { type: "string", enum: ["ok", "error"] },
                    timestamp: { type: "string", format: "date-time" },
                    checks: {
                      type: "object",
                      properties: {
                        server:   { type: "object", properties: { status: { type: "string" } } },
                        database: { type: "object", properties: { status: { type: "string" }, latencyMs: { type: "integer" } } },
                        tables:   { type: "object", properties: { status: { type: "string" }, checked: { type: "integer" } } },
                      },
                    },
                  },
                },
              },
            },
          },
          503: { description: "One or more checks failed (database unreachable or tables missing)" },
        },
      },
    },

    // ── Dashboard ───────────────────────────────────────────────────────
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Dashboard stats",
        description: "Returns user counts and recent registrations.",
        responses: {
          200: {
            description: "Stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalUsers:    { type: "integer" },
                    pendingUsers:  { type: "integer" },
                    approvedUsers: { type: "integer" },
                    auditCount:    { type: "integer" },
                    recentUsers:   { type: "array", items: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── Users ───────────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List all users",
        description: "Returns all users ordered by creation date. Admin only.",
        responses: {
          200: { description: "User list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
        },
      },
    },
    "/users/{id}": {
      patch: {
        tags: ["Users"],
        summary: "Update a user",
        description: "Update status and/or role. Admin only.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["pending", "approved", "rejected"] },
                  role:   { type: "string", enum: ["user", "admin"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
          404: { description: "User not found" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete a user",
        description: "Permanently removes a user. Admin only.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Deleted" },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
        },
      },
    },

    // ── Audit ───────────────────────────────────────────────────────────
    "/audit": {
      get: {
        tags: ["Audit"],
        summary: "List audit log entries",
        description: "Paginated audit log with optional action filter. Admin only.",
        parameters: [
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 25 } },
          { name: "action", in: "query", schema: { type: "string" }, description: "Filter by action name" },
        ],
        responses: {
          200: {
            description: "Paginated results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entries: { type: "array", items: { $ref: "#/components/schemas/AuditEntry" } },
                    total:   { type: "integer" },
                    page:    { type: "integer" },
                    pages:   { type: "integer" },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
        },
      },
    },

    // ── Feature Flags ────────────────────────────────────────────────────
    "/feature-flags": {
      get: {
        tags: ["Feature Flags"],
        summary: "List all feature flags",
        description: "Returns all flags and their enabled state. Available to all authenticated users (for client-side enforcement).",
        responses: {
          200: {
            description: "Map of flag key → flag object",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: {
                    type: "object",
                    properties: {
                      key:         { type: "string" },
                      enabled:     { type: "boolean" },
                      label:       { type: "string" },
                      description: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/feature-flags/{key}": {
      patch: {
        tags: ["Feature Flags"],
        summary: "Toggle a feature flag",
        description: "Enable or disable a named feature flag. Admin only.",
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } },
            },
          },
        },
        responses: {
          200: { description: "Flag updated" },
          400: { description: "Invalid payload" },
          401: { description: "Not authenticated" },
          403: { description: "Admin role required" },
          404: { description: "Flag not found" },
        },
      },
    },

    // ── Changelog ───────────────────────────────────────────────────────
    "/changelog": {
      get: {
        tags: ["Changelog"],
        summary: "List changelog entries",
        description: "Returns all development changelog entries ordered by date descending. Entries are sourced from `src/data/changelog.ts` and synced to the DB on startup.",
        responses: {
          200: {
            description: "Array of changelog entries",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id:          { type: "integer" },
                      date:        { type: "string", format: "date" },
                      description: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },

    // ── OpenAPI ─────────────────────────────────────────────────────────
    "/openapi": {
      get: {
        tags: ["Meta"],
        summary: "OpenAPI specification",
        description: "Returns this OpenAPI 3.0 spec as JSON.",
        security: [],
        responses: {
          200: { description: "OpenAPI spec" },
        },
      },
    },
  },
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(spec);
}
