# Contributing to TrickFire Dashboard

Thanks for contributing. This doc covers the workflow, conventions, and gotchas you need to know before opening a PR.

If you haven't set up the project yet, start with the [Local Development section in README.md](README.md#local-development).

## Project Structure

```
dashboard/
├── src/
│   ├── app/                    # Next.js App Router - pages and API routes
│   │   ├── (auth)/             # Login / register pages (unauthenticated layout)
│   │   ├── (dashboard)/        # Authenticated pages + shared layout
│   │   │   ├── layout.tsx      # Auth gate + sidebar/topnav shell
│   │   │   ├── dashboard/      # Member overview page
│   │   │   ├── orders/         # Order submission + history
│   │   │   ├── api-keys/       # API Key Vault
│   │   │   ├── minecraft/      # Minecraft status, whitelist requests, leaderboard
│   │   │   ├── headscale/      # Network join requests
│   │   │   └── admin/          # Admin-only pages (order queue, users, etc.)
│   │   ├── api/                # Route handlers
│   │   │   ├── service/        # External service endpoints (e.g. API key verify)
│   │   │   └── minecraft/      # Internal endpoints (status, leaderboard)
│   │   └── pl3xmap/            # Pl3xMap reverse proxy (forwards to PL3XMAP_URL)
│   ├── components/
│   │   ├── layout/             # Sidebar, TopNav
│   │   ├── minecraft/          # Minecraft-specific components (status, leaderboard, map)
│   │   └── ui/                 # shadcn/ui primitives (buttons, cards, dialogs, etc.)
│   └── lib/
│       ├── db/
│       │   ├── schema.ts       # Application tables (edit this for schema changes)
│       │   └── auth-schema.ts  # better-auth managed tables - do not edit
│       ├── auth.ts             # better-auth server configuration
│       ├── auth-client.ts      # better-auth browser client
│       ├── minecraft.ts        # Minecraft server status ping + bot name resolution
│       └── minecraft-stats.ts  # Playtime leaderboard from world stat files + Mojang API
├── drizzle/                    # Auto-generated migration files - do not edit by hand
├── scripts/
│   └── seed.ts                 # Database seed (teams + admin)
└── public/                     # Static assets served as-is
```

> [!CAUTION]
> `src/lib/db/auth-schema.ts` is managed by better-auth. Do not edit it - your changes will be overwritten the next time better-auth regenerates it. Auth-related customisation belongs in `src/lib/auth.ts`.

## Database Schema

| Table                    | Description                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `user`                   | Registered members. `role` is `"admin"` or `"member"`. `isActive = false` blocks access without deleting the account. |
| `session`                | Active auth sessions - managed by better-auth, don't touch.                                                           |
| `account`                | Auth provider records - managed by better-auth, don't touch.                                                          |
| `verification`           | Email verification tokens - managed by better-auth, don't touch.                                                      |
| `team`                   | The 6 robot sub-teams. Seeded once; not user-editable through the UI.                                                 |
| `orders`                 | Part order requests. Status flows: `pending → approved / rejected → ordered`.                                         |
| `api_key`                | Hashed service API keys issued to members. Only the prefix and hash are stored.                                       |
| `vault_entry`            | API Key Vault entries (shared `login` / `api_key` credentials), AES-256-GCM encrypted at rest.                        |
| `vault_entry_access`     | Per-person read grants for vault entries. A row `(entry_id, user_id)` lets that user read that secret.                |
| `minecraft_whitelist`    | Minecraft username whitelist requests. `addedDirectly` marks admin-added entries.                                     |
| `headscale_join_request` | Requests to join the Tailscale network. Approved requests still require manual action in the Tailscale admin console. |

> [!NOTE]
> All timestamps are stored as **millisecond integers** (`timestamp_ms`). Use `datetime(col / 1000, 'unixepoch')` when querying raw SQL.

### Inspecting the database

```bash
sqlite3 db/dashboard.db
```

```sql
.tables
.schema orders
SELECT * FROM orders WHERE status = 'pending';
.quit
```

## Development Workflow

1. Branch off `main` using the naming convention below.
2. Make your changes.
3. Verify lint and formatting pass locally.
4. Open a pull request against `main` with a short description of what changed and why.

### Branch Naming

| Type          | Pattern                     | Example              |
| ------------- | --------------------------- | -------------------- |
| Feature       | `feat/<short-description>`  | `feat/order-export`  |
| Bug fix       | `fix/<short-description>`   | `fix/session-expiry` |
| Chore / infra | `chore/<short-description>` | `chore/update-deps`  |

## Commit Messages

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/). A git hook enforces this automatically - bad commits are blocked before they land.

```
<type>: <short description>
```

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature or behaviour                        |
| `fix`      | Bug fix                                         |
| `chore`    | Maintenance, deps, config - no behaviour change |
| `docs`     | Documentation only                              |
| `style`    | Formatting, whitespace - no logic change        |
| `refactor` | Code restructure with no feature or fix         |
| `perf`     | Performance improvement                         |
| `ci`       | CI/CD changes                                   |
| `revert`   | Reverts a previous commit                       |

The hook is installed automatically by `pnpm install`. Use `git commit --no-verify` only in genuine emergencies.

## Code Style

ESLint and Prettier are configured and run in CI.

```bash
pnpm lint          # ESLint
pnpm format:check  # Prettier check (no writes)
pnpm format        # auto-fix formatting
```

> [!TIP]
> In VS Code, install the ESLint and Prettier extensions and enable **Format on Save** - you won't need to run these manually.

## Pull Requests

- **Keep PRs focused** - one concern per PR. A PR that adds a feature and refactors an unrelated component is harder to review and harder to revert.
- **Write a useful description** - explain what changed and why, not just what the diff shows. Link to relevant issues or Slack threads.
- **Schema changes need a migration** - if your PR touches `src/lib/db/schema.ts`, include the generated migration file (see [Database Changes](#database-changes) below).

## Adding Pages

Pages live under `src/app/(dashboard)/`. The `(dashboard)` route group applies the authenticated layout automatically.

1. Create `src/app/(dashboard)/<your-route>/page.tsx`
2. Add a nav entry in `src/components/layout/Sidebar.tsx` if it should appear in the sidebar
3. Add a corresponding entry to the `routeLabels` map in `src/components/layout/TopNav.tsx` so the topnav shows the right page title

Admin-only pages go under `src/app/(dashboard)/admin/`. The auth gate in `layout.tsx` only checks authentication - admin-only access must be enforced inside the page or its API routes.

## Database Changes

Always pair a schema edit with a generated migration and commit both together:

```bash
# 1. Edit src/lib/db/schema.ts
# 2. Generate the migration
pnpm db:generate
# 3. Apply it locally and verify the app still works
pnpm db:migrate
# 4. Commit schema.ts + the new file in drizzle/ in the same commit
```

> [!WARNING]
> Never edit files inside `drizzle/` by hand after they have been committed. Drizzle checksums each migration file and will refuse to run if it detects manual edits. To undo a migration, generate a new one that reverses the change - don't touch the existing file.

## Working with the API

The external-facing REST API lives under `src/app/api/service/`. This is the endpoint called by the lab's simulation Python scripts to verify API keys.

Internal data fetching uses React Server Components and server actions - there is no separate internal REST layer. Server components call the database directly via Drizzle.

Internal route handlers (e.g. `GET /api/minecraft/leaderboard`) exist for data that must be fetched client-side (polled components, client-rendered cards). These require authentication - validate the session with `auth.api.getSession` before returning any data.

> [!NOTE]
> `POST /api/service/verify` is IP-rate-limited in production via Cloudflare headers. There is no rate limiting in local dev - don't rely on that behaviour in tests.

## Proxying External Services

Some internal services (currently Pl3xMap) are proxied through the Next.js app so they are accessible via the dashboard URL without exposing a second port. The proxy lives at `src/app/pl3xmap/[[...path]]/route.ts`.

Key points:

- Use a catch-all route handler (`[[...path]]`) so all sub-paths forward correctly.
- For SPA-based services, you may need to rewrite the HTML `<base href>` tag so asset paths resolve through the proxy prefix. The Pl3xMap handler does this.
- Catch `ECONNREFUSED` / `ENOTFOUND` and return a `503` so the client can show a graceful unavailable state instead of an unhandled error.

## Shared Fetch with Multiple Grid Cards

When two adjacent cards share a single data fetch (to avoid duplicate requests), wrap them in a container component that uses `className="contents"` (`display: contents`). This makes the wrapper invisible to CSS Grid, so the child cards participate in the outer grid as direct items while the fetch logic lives in one place. See `ServerStatusSection.tsx` for an example.

## Environment: Dev vs. Production

| Concern               | Local dev                                            | Production                                |
| --------------------- | ---------------------------------------------------- | ----------------------------------------- |
| Database              | `db/dashboard.db` in repo root                       | `/home/trickfire/db/dashboard.db`         |
| Server                | `pnpm dev` (Turbopack, hot reload)                   | systemd + `.next/standalone/server.js`    |
| HTTPS                 | None (HTTP on port 3000)                             | Cloudflare Tunnel provides TLS            |
| Minecraft / Tailscale | Optional - app degrades gracefully                   | Required - configure in `.env.production` |
| LAN access            | Set `BETTER_AUTH_TRUSTED_ORIGINS` to the LAN IP:port | Not needed - all traffic goes via Tunnel  |

## Getting Help

Check inline comments first - they're sparse but mark non-obvious behaviour. If you're still stuck, ask in the team Slack.
