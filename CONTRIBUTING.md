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

## Commit Messages

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format. A git hook enforces this automatically & bad commits are blocked before they land.

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

Examples:

```
feat: add export button to orders page
fix: resolve session expiry on mobile Safari
chore: update drizzle-orm to 0.46
docs: document proxy setup in CONTRIBUTING
```

The hook is installed automatically when you run `pnpm install`. If you want to skip it in a one-off emergency, use `git commit --no-verify` but please don't make it a habit.

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

Internal route handlers (e.g. `GET /api/minecraft/leaderboard`) exist for data that must be fetched client-side (polled components, client-rendered cards). These require authentication - validate the session with `auth.api.getSession` before returning any data.

> [!NOTE]
> The `POST /api/service/verify` endpoint is IP-rate-limited in production via Cloudflare headers. In local dev there is no rate limiting - don't rely on that behaviour in tests.

## Proxying External Services

Some internal services (currently BlueMap) are proxied through the Next.js app so they are accessible via the dashboard URL without exposing a second port. The proxy lives at `src/app/bluemap/[[...path]]/route.ts` and forwards requests to `BLUEMAP_URL`.

Key points:

- Use a catch-all route handler (`[[...path]]`) so all sub-paths forward correctly.
- For SPA-based services, you may need to rewrite the HTML `<base href>` tag so asset paths resolve through the proxy prefix rather than the root. The BlueMap handler does this.
- Catch `ECONNREFUSED` / `ENOTFOUND` and return a `503` so the client component can show a graceful unavailable state instead of an unhandled error.

## Shared Fetch with Multiple Grid Cards

When two adjacent cards share a single data fetch (to avoid duplicate requests), wrap them in a container component that uses `className="contents"` (`display: contents`). This makes the wrapper invisible to CSS Grid, so the child cards participate in the outer grid as direct items while the fetch logic lives in one place. See `ServerStatusSection.tsx` for an example.

## Environment in Dev vs Production

| Concern               | Local dev                                                         | Production                                |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| Database              | `db/dashboard.db` in repo root                                    | `/home/trickfire/db/dashboard.db`         |
| Server                | `pnpm dev` (hot reload, Turbopack)                                | systemd + `.next/standalone/server.js`    |
| HTTPS                 | None (HTTP on port 3000)                                          | Cloudflare Tunnel provides TLS            |
| Minecraft / Tailscale | Optional - app degrades gracefully                                | Required - configure in `.env.production` |
| LAN access            | Set `BETTER_AUTH_TRUSTED_ORIGINS` to the LAN IP:port (see README) | Not needed - all traffic goes via Tunnel  |

## Getting Help

If something in the codebase isn't clear, check the inline comments first (there aren't many, but the ones that exist mark non-obvious behaviour). If you're still stuck, ask in the team Slack.
