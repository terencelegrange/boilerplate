# Boilerplate: Full-Stack Authenticated Web App Foundation

A production-ready foundation and starter template for building secure, scalable, authenticated web applications with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma**, and **MySQL**.

---

## 🎯 Purpose & Vision

Starting a new full-stack web application often requires re-implementing the same foundational features: database setup, authentication, user management, authorization, audit logging, feature flags, and observability. 

This **Boilerplate** serves as the definitive starting point for any modern web application. It comes pre-equipped with enterprise-grade infrastructure and a modular administrative dashboard so you can focus entirely on building your core domain logic.

---

## ✨ Key Capabilities & Modules

### 1. First-Run Installation & Database Setup
- **Zero-Config First Run**: Automatically detects when no database connection is configured and guides you through a web setup wizard (`/setup`).
- **Live Connection Test**: Probes MySQL host, port, credentials, and permissions before applying configuration.
- **Automated Schema Bootstrap**: Creates all tables, relational constraints, default RBAC permissions, and seeds the initial administrator account.
- **Dynamic Pool Management**: Reconnects Prisma on the fly without requiring a server process restart.

### 2. Authentication & Multi-Profile Login
- **Edge-Safe JWT Authentication**: Fast, stateless session management using `jose` with `httpOnly` cookies (`bp_token`).
- **Netflix-Style Profile Switcher**: Remembers signed-in accounts as avatar tiles for one-click switching on trusted devices.
- **"Trust This Device" (Passwordless Access)**: Issues 30-day SHA-256 hashed device tokens allowing remembered users to skip password entry.
- **User Approval Lifecycle**: New user registrations enter a `pending` state awaiting admin review.
- **Bcrypt Password Security**: Secure 10-round salted password hashing.

### 3. Role-Based Access Control (RBAC)
- **Granular Navigation Permissions**: Many-to-many permission mapping (`role_permissions` table).
- **Settings $\rightarrow$ Roles UI**: Interactive permission matrix to enable or disable specific navigation items per role (Admin, Editor, Viewer).

### 4. Security Hub (Settings $\rightarrow$ Security)
- **Security & Access Controls**: Centralized hub managing identity verification, biometric authentication, and data governance.
- **Multi-Factor Authentication (MFA)**: Landing page (`/settings/security/mfa`) for planned RFC 6238 TOTP authenticator pairing and emergency recovery codes.
- **Passkeys (FIDO2 / WebAuthn)**: Landing page (`/settings/security/passkeys`) for biometric Touch ID, Face ID, Windows Hello, and hardware YubiKey passwordless authentication.
- **Forensic Watermarking**: Landing page (`/settings/security/watermarking`) for dynamic visual session overlays and steganographic data export tagging to trace leaks.

### 5. User Management (Settings $\rightarrow$ Users)
- **User Directory**: View, search, and manage all registered accounts.
- **Lifecycle Controls**: Approve pending signups, reject accounts, promote users to admins, or remove users.
- **Profile Customization**: Choose avatar illustrations and update personal details.

### 6. Audit Logging (Settings $\rightarrow$ Audit Log)
- **Non-Blocking Telemetry**: Centralized `auditLog()` helper records user actions, IPs, timestamps, and metadata without slowing down web requests.
- **Paginated Viewer**: Searchable, filterable audit log stream in the administrative dashboard.

### 6. Observability Hub (Settings $\rightarrow$ Observability)
- **Analytics Connector**: Streams user events and product telemetry to custom analytics endpoints with configurable API keys, batch sizes, timeouts, and custom headers.
- **Log Collector**: Ships structured logs and exception traces to central log aggregators (e.g. Logstash, Datadog, Grafana Loki) with configurable log-level filtering (`DEBUG`, `INFO`, `WARN`, `ERROR`).
- **Live Payload Schema Previews**: Interactive formatted JSON schema viewer.
- **Live Test Probes**: Send live test payloads with real-time latency (ms) and HTTP status reporting.

### 7. Developer API Keys (Settings $\rightarrow$ API Access)
- **Named Bearer Tokens**: Generate scoped API keys (`bp_live_...`) with optional expiration dates and contact information.
- **SHA-256 Hashed Storage**: Keys are only displayed once upon creation and stored securely in `api_keys`.
- **Universal Middleware Support**: Authenticates external programmatic requests via `Authorization: Bearer <token>`.

### 8. Feature Flags (Settings $\rightarrow$ Feature Flags)
- **Runtime Toggles**: Dynamically enable or disable features (such as public user registration, dashboard views, or sidebar menus) without redeploying.
- **Fail-Open Architecture**: Gracefully defaults to enabled state if database connectivity is momentarily degraded.

### 9. Interactive API Documentation (Settings $\rightarrow$ Documentation)
- **Live OpenAPI 3.0 Specification**: Generated dynamically from `src/app/api/openapi/route.ts`.
- **Integrated UI Explorer**: Browse request/response schemas, HTTP status codes, and authentication requirements directly in the admin panel.

### 10. Automated Changelog (Settings $\rightarrow$ Changelog)
- **Developer-Friendly Tracking**: Add entries to `src/data/changelog.ts` and have them automatically synced to the database (`changelog` table) on startup.

### 11. Theme & UI System
- **Server-Side Rendered Dark / Light Mode**: Theme preference stored in `bp_theme` cookie to prevent page flicker on initial load.
- **Tailwind CSS v3**: Class-based dark mode (`dark:`) with smooth transitions and responsive layouts.

---

## 🏗️ Architecture Overview

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (with `darkMode: "class"`)
- **ORM / Database**: Prisma 5 + MySQL (compatible with AWS RDS, PlanetScale, DigitalOcean, self-hosted MySQL)
- **Authentication**: JWT (`jose`) + `bcryptjs`
- **Default Port**: `3333` (development and production)

### Directory Structure

```text
src/
  app/
    (dashboard)/                # Authenticated application shell
      layout.tsx                # Sidebar, top navigation, profile menu & RBAC guards
      page.tsx                  # Dashboard summary tiles & stats
      audit/page.tsx            # Standalone audit log view
      profile/page.tsx          # User profile & password update
      settings/
        page.tsx                # Settings overview hub
        users/page.tsx          # User management & approvals
        roles/page.tsx          # RBAC permissions matrix
        audit/page.tsx          # Embedded audit log viewer
        feature-flags/page.tsx  # Dynamic feature flag toggles
        api-access/page.tsx     # Developer API keys
        security/               # Security settings hub
          page.tsx              # Security summary hub (MFA, Passkeys, Watermarking)
          mfa/page.tsx          # Multi-Factor Authentication landing page
          passkeys/page.tsx     # Passkeys / WebAuthn landing page
          watermarking/page.tsx # Forensic Watermarking landing page
        observability/          # Observability settings hub
          page.tsx              # Analytics & Log Collector summary cards
          analytics/page.tsx    # Analytics ingestion connector config & test
          log-collector/page.tsx # Log forwarding connector config & test
        documentation/page.tsx  # Interactive OpenAPI 3.0 documentation
        changelog/page.tsx      # In-app changelog
    (setup)/                    # First-run setup wizard
      layout.tsx
      setup/page.tsx            # MySQL config, connection test & admin creation
      setup/complete/page.tsx   # Completion confirmation
    api/                        # Backend REST API routes
      auth/                     # Login, logout, signup, device tokens
      me/                       # Profile updates, theme preferences
      users/                    # User CRUD & approval actions
      rbac/                     # Role definitions & user permission endpoints
      audit/                    # Paginated audit log retrieval
      dashboard/                # Summary statistics
      feature-flags/            # Feature flag management
      api-keys/                 # Developer API key generation & revocation
      observability/            # Observability config & live test dispatcher
      setup/                    # Setup status, DB testing & completion
      openapi/                  # Dynamic OpenAPI 3.0 JSON spec
      changelog/                # Changelog feed
    login/page.tsx              # Multi-profile & password login page
    signup/page.tsx             # New user registration page
    layout.tsx                  # Root layout (SSR theme injection)
    globals.css
  data/
    nav.ts                      # Navigation links & default role permissions
    changelog.ts                # Static changelog source of truth
  lib/
    auth.ts                     # JWT sign/verify, device tokens, session parser
    prisma.ts                   # Dynamic Prisma singleton with reset capability
    setup.ts                    # Setup state detection & site.config.json management
    initDb.ts                   # Schema creation & bootstrap seeding
    audit.ts                    # auditLog() helper with background telemetry hook
    observability.ts            # External telemetry dispatcher & config reader
    flags.ts                    # Feature flag resolver (isFlagEnabled)
    avatar.ts                   # Avatar rendering helpers
    profiles.ts                 # Local profile memory & trusted device storage
  middleware.ts                 # Edge-runtime route protection & API key bypass
```

---

## 💾 Database Schema

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | User accounts & credentials | `id`, `email`, `password_hash`, `name`, `role`, `status`, `avatar`, `theme` |
| `device_tokens` | "Trust this device" logins | `id`, `user_id`, `token_hash`, `expires_at`, `created_at` |
| `api_keys` | Developer Bearer API keys | `id`, `name`, `key_hash`, `contact`, `active`, `expires_at`, `last_used` |
| `role_permissions` | RBAC navigation access | `role`, `nav_key` (Composite Primary Key) |
| `audit_logs` | Security & activity records | `id`, `user_id`, `action`, `resource`, `resource_id`, `details`, `ip`, `created_at` |
| `observability_config` | Analytics & logs configuration | `key`, `enabled`, `api_key`, `endpoint`, `config_json`, `updated_at` |
| `feature_flags` | Runtime feature toggles | `key`, `enabled`, `label`, `description` |
| `changelog` | Synchronized release notes | `id`, `date`, `description`, `created_at` |

---

## 🚀 Getting Started

### 1. Installation
```bash
git clone <your-repo-url>
cd boilerplate
npm install
```

### 2. Development Server
```bash
npm run dev
```
Open **`http://localhost:3333`** in your browser.

- If no `.env` or `site.config.json` exists, you will automatically be greeted by the **Setup Wizard** at `/setup`.
- Enter your MySQL database credentials, click **"Test Database Connection"**, and configure your Administrator account.
- The wizard automatically saves your configuration, bootstraps the database schema, and redirects you to sign in.

---

## ⚙️ Adding New Features & Guidelines

### Adding a New Sidebar Navigation Page
1. Add your page at `src/app/(dashboard)/<your-route>/page.tsx`.
2. Add the item to `NAV_ITEMS` in `src/data/nav.ts` with a unique `key`, `href`, `label`, and SVG icon.
3. Configure which roles can view it in `DEFAULT_ROLE_PERMISSIONS` in `src/data/nav.ts`.
4. `initDb()` will automatically seed the permission on next load.

### Adding a New API Route
1. Create your route at `src/app/api/<path>/route.ts`.
2. Document the endpoint in `src/app/api/openapi/route.ts` under the OpenAPI `paths` object.
3. Record database modifications using `auditLog({ action: "YOUR_ACTION", resource: "...", ... })`.
4. If admin-only, verify `session.role === "admin"` before executing sensitive actions.

### Updating the Changelog
Whenever completing a feature:
1. Add an entry to the **top** of `CHANGELOG` in `src/data/changelog.ts`:
   ```ts
   { date: "YYYY-MM-DD", description: "Brief description of the change" },
   ```
2. The changelog table and Settings UI will synchronize automatically.

---

## 🐳 Docker Deployment

The application is configured for standalone production Docker builds:
```bash
npm run build
npm start
```
- In `next.config.ts`, `output: "standalone"` is enabled.
- Ensure `PORT=3333` or your preferred production port is set in your environment.
