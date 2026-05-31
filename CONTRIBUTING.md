# Contributing to TrickFire Dashboard

Thanks for contributing. This doc covers the workflow, conventions, and gotchas you need to know before opening a PR.

If you haven't set up the project yet, start with the [Local Development section in README.md](README.md#local-development).

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

## Code Style

ESLint and Prettier are configured. Both run in CI and on save in VS Code (with the recommended extensions).

Before pushing:

```bash
pnpm lint          # ESLint - catches type errors, unused imports, etc.
pnpm format:check  # Prettier - formatting check without writing
```

To auto-fix formatting:

```bash
pnpm format
```

> [!TIP]
> If you're using VS Code, install the ESLint and Prettier extensions and enable "Format on Save" - you won't need to run these manually.

## Pull Requests

- **Keep PRs focused** - one concern per PR. A PR that adds a feature and refactors an unrelated component is harder to review and harder to revert.
- **Write a useful description** - explain what changed and why, not just what the diff shows. Link to any relevant issues or Slack threads.
- **Schema changes need a migration** - if your PR touches `src/lib/db/schema.ts`, include the generated migration file. See [Database Changes](#database-changes) below.

## Adding Pages

Pages live under `src/app/(dashboard)/`. The `(dashboard)` route group applies the authenticated layout (auth gate, sidebar, topnav) automatically.

To add a new page:

1. Create `src/app/(dashboard)/<your-route>/page.tsx`
2. Add a nav entry in `src/components/layout/Sidebar.tsx` if it should appear in the sidebar
3. Add a corresponding entry to the `routeLabels` map in `src/components/layout/TopNav.tsx` so the topnav shows the right page title

Admin-only pages go under `src/app/(dashboard)/admin/`. The auth gate in `layout.tsx` only checks that the user is authenticated - admin-only access must be enforced inside the page or its API routes.

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
> Never edit files inside `drizzle/` by hand after they have been committed. Drizzle checksums each migration file and will refuse to run if it detects manual edits. If you need to undo a migration, generate a new one that reverses the change - don't touch the existing file.

> [!CAUTION]
> Do **not** edit `src/lib/db/auth-schema.ts`. It is managed by better-auth and will be regenerated, overwriting any manual changes. Auth-related column customisation belongs in `src/lib/auth.ts`.

## Working with the API

The external-facing REST API lives under `src/app/api/service/`. This is the endpoint called by the lab's simulation Python scripts to verify API keys.

Internal data fetching uses React Server Components and server actions - there is no separate internal REST layer. Server components call the database directly via Drizzle.

> [!NOTE]
> The `POST /api/service/verify` endpoint is IP-rate-limited in production via Cloudflare headers. In local dev there is no rate limiting - don't rely on that behaviour in tests.

## Environment in Dev vs Production

| Concern               | Local dev                          | Production                                 |
| --------------------- | ---------------------------------- | ------------------------------------------ |
| Database              | `db/dashboard.db` in repo root     | `/opt/trickfire-dashboard/db/dashboard.db` |
| Server                | `pnpm dev` (hot reload, Turbopack) | systemd + `.next/standalone/server.js`     |
| HTTPS                 | None (HTTP on port 3000)           | Cloudflare Tunnel provides TLS             |
| Minecraft / Headscale | Optional - app degrades gracefully | Required - configure in `.env.local`       |

## Getting Help

If something in the codebase isn't clear, check the inline comments first (there aren't many, but the ones that exist mark non-obvious behaviour). If you're still stuck, ask in the team Slack.
