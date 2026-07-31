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
        description: "Authenticates a user and sets `bp_token` + `bp_theme` cookies.",
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
                  password: { type: "string" },
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
        description: "Clears the session cookie.",
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
        description: "Returns the current user's name, email, and avatar number (1–127; null means no avatar saved — caller should derive a default).",
        responses: {
          200: { description: "Profile data", content: { "application/json": { schema: { type: "object", properties: { name: { type: "string", nullable: true }, email: { type: "string" }, avatar: { type: "integer", nullable: true, minimum: 1, maximum: 127 } } } } } },
          401: { description: "Not authenticated" },
          404: { description: "User not found" },
        },
      },
      patch: {
        tags: ["Me"],
        summary: "Update own profile",
        description: "Update name, email, and/or password for the currently logged-in user. Password change requires `currentPassword`.",
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

    // ── Sites ───────────────────────────────────────────────────────────
    "/sites": {
      get: {
        tags: ["Sites"],
        summary: "List all monitored sites",
        description: "Returns sites filtered by environment (dev, tst, stg, prd).",
        parameters: [
          { name: "env", in: "query", description: "Target environment to filter by", required: false, schema: { type: "string", default: "dev" } }
        ],
        responses: {
          200: { description: "List of sites" },
          401: { description: "Not authenticated" }
        }
      },
      post: {
        tags: ["Sites"],
        summary: "Create a new monitored site",
        description: "Creates a site to be monitored in the specified environment. Admin only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "url", "health_check_url", "environment"],
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  health_check_url: { type: "string" },
                  environment: { type: "string", enum: ["dev", "tst", "stg", "prd"] }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Site created" },
          401: { description: "Not authenticated" },
          403: { description: "Forbidden - Admin only" }
        }
      }
    },
    "/sites/{id}": {
      patch: {
        tags: ["Sites"],
        summary: "Update site configuration",
        description: "Modifies site monitoring parameters. Admin only.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  health_check_url: { type: "string" },
                  environment: { type: "string", enum: ["dev", "tst", "stg", "prd"] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Site updated" },
          401: { description: "Not authenticated" },
          403: { description: "Forbidden - Admin only" },
          404: { description: "Site not found" }
        }
      },
      delete: {
        tags: ["Sites"],
        summary: "Delete monitored site",
        description: "Deletes a site and all its health check history. Admin only.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        responses: {
          200: { description: "Site deleted" },
          401: { description: "Not authenticated" },
          403: { description: "Forbidden - Admin only" },
          404: { description: "Site not found" }
        }
      }
    },
    "/health-checks": {
      get: {
        tags: ["Health Checks"],
        summary: "List sites with recent health check history",
        description: "Returns sites in an environment along with their last 5 execution logs.",
        parameters: [
          { name: "env", in: "query", description: "Target environment to filter by", required: false, schema: { type: "string", default: "dev" } }
        ],
        responses: {
          200: { description: "List of sites with their logs" },
          401: { description: "Not authenticated" }
        }
      }
    },
    "/health-checks/run": {
      post: {
        tags: ["Health Checks"],
        summary: "Execute health checks on-demand",
        description: "Checks all sites in the environment or a specific site by siteId, stores results, and updates site status.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  siteId: { type: "integer", description: "Optionally specify single site ID to check" },
                  env: { type: "string", description: "Optionally specify target environment to check all sites" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Checks executed successfully" },
          401: { description: "Not authenticated" }
        }
      }
    },
    "/health-checks/report": {
      post: {
        tags: ["Health Checks"],
        summary: "Report health check results from external agents",
        description: "Allows external monitoring agents to report status results directly to the dashboard using an API Key. Requires editor or admin role.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["siteId", "status"],
                properties: {
                  siteId: { type: "integer", description: "The ID of the monitored site" },
                  status: { type: "string", enum: ["up", "down"], description: "The reported status of the site" },
                  statusCode: { type: "integer", description: "Optional HTTP status code returned by the health check" },
                  latency: { type: "integer", description: "Optional latency measurement in milliseconds" },
                  error: { type: "string", description: "Optional error message if the site was reported down" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Report recorded successfully" },
          400: { description: "Invalid parameters" },
          401: { description: "Not authenticated" },
          403: { description: "Forbidden - Editor/Admin only" },
          404: { description: "Site not found" }
        }
      }
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
