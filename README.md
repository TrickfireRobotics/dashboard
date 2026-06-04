# TrickFire Dashboard

Internal portal for [TrickFire Robotics](https://trickfirerobotics.com). Members submit part orders and Minecraft whitelist requests; admins review and action them. A service API used by simulation scripts is also exposed through the same server.

**Production:** `https://dashboard.trickfirerobotics.com` - runs a server in our lab room behind a Cloudflare Tunnel.

## Tech Stack

| Layer           | Choice                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Next.js 15](https://nextjs.org/) - App Router, React Server Components, `output: "standalone"`                      |
| Database        | SQLite via [Drizzle ORM](https://orm.drizzle.team) + [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)  |
| Auth            | [better-auth](https://www.better-auth.com) - email/password, session cookies                                         |
| UI              | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com), [Lucide icons](https://lucide.dev/) |
| Email           | [Resend](https://resend.com)                                                                                         |
| Network         | [Headscale](https://headscale.net) self-hosted Tailscale control server                                              |
| Package manager | [`pnpm`](https://pnpm.io/)                                                                                           |

## Local Development

### Prerequisites

- Node.js ≥ 20
- `pnpm` package manager
- A C++ build toolchain (only if `better-sqlite3` has no prebuilt for your platform)

#### 1. Install dependencies

```bash
pnpm install
```

#### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in values. For local dev you only strictly need `BETTER_AUTH_SECRET`; everything else has a workable default or degrades gracefully. See [Environment Variables](#environment-variables) for the full reference.

#### 3. Initialize the database

```bash
pnpm db:migrate   # apply schema migrations
pnpm db:seed      # seed base database
```

> [!NOTE]
> The seed is safe to run multiple times - teams use `ON CONFLICT DO NOTHING` and the admin account is only created if the email doesn't already exist.

#### 4. Start the dev server

```bash
pnpm dev
```

Open `http://localhost:3000` and log in with the credentials from `SEED_ADMIN_*` in your `.env.local`.

## Environment Variables

| Variable                      | Description                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`         | Public origin of the app, e.g. `http://localhost:3000`                                                                                                                |
| `BETTER_AUTH_SECRET`          | Random secret for signing sessions - generate with `openssl rand -hex 32`                                                                                             |
| `BETTER_AUTH_URL`             | Same value as `NEXT_PUBLIC_APP_URL`                                                                                                                                   |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated extra origins allowed to make auth requests, e.g. `http://192.168.1.50:3000`. Required when accessing the dev server from another machine on the LAN. |
| `DATABASE_PATH`               | Path to the SQLite file, e.g. `db/dashboard.db`                                                                                                                       |
| `VAULT_ENCRYPTION_KEY`        | AES-256 key (hex) encrypting API Key Vault secrets at rest - generate with `openssl rand -hex 32`. **Required in production.** In local dev, if unset, a key is auto-generated and persisted to `db/vault.key`. |
| `SEED_ADMIN_EMAIL`            | Email for the seeded admin account                                                                                                                                    |
| `SEED_ADMIN_PASSWORD`         | Password for the seeded admin account                                                                                                                                 |
| `SEED_ADMIN_NAME`             | Display name for the seeded admin                                                                                                                                     |
| `MINECRAFT_SERVER_HOST`       | Hostname/IP of the Minecraft server                                                                                                                                   |
| `MINECRAFT_SERVER_PORT`       | Port of the Minecraft server (default `25565`)                                                                                                                        |
| `MINECRAFT_WORLD_PATH`        | Absolute path to the Minecraft world directory, e.g. `/opt/minecraft/world`. Used to read per-player stat files for the playtime leaderboard.                         |
| `MINECRAFT_BOT_NAMES`         | Comma-separated list of carpet bot names, optionally with a custom skin source: `BotA:Steve,BotB:https://s.namemc.com/i/abc123.png`. Bots are tagged in the UI.       |
| `BLUEMAP_URL`                 | Internal URL of the BlueMap web server, e.g. `http://localhost:8100`. The dashboard proxies this at `/bluemap` so it's accessible without exposing a second port.     |
| `RESEND_API_KEY`              | API key from [Resend](https://resend.com) for transactional email                                                                                                     |
| `EMAIL_FROM`                  | Sender shown in outgoing emails, e.g. `TrickFire Robotics <noreply@trickfirerobotics.com>`                                                                            |
| `HEADSCALE_URL`               | Base URL of the Headscale REST API, e.g. `http://localhost:50443`                                                                                                     |
| `HEADSCALE_API_KEY`           | API key generated by Headscale                                                                                                                                        |

> [!TIP]
> `MINECRAFT_SERVER_HOST`, `MINECRAFT_WORLD_PATH`, `BLUEMAP_URL`, `RESEND_API_KEY`, and `HEADSCALE_*` are optional for local dev. The app handles unreachable services gracefully - the Minecraft card shows "offline", the leaderboard and map show an unavailable state, email features are skipped, and the Network tab shows an error state.

> [!CAUTION]
> Never commit `.env.local` or any file containing `BETTER_AUTH_SECRET`. It must stay off `git` - anyone who has it can forge session tokens.

### API Key Vault

The **API Keys** page is a secret vault: admins store shared credentials (third-party API keys, service logins) and grant per-member read access via the **Vault access** toggle on the Users admin page. Each entry is either a _login_ (username + password) or a single _API key_, and can be marked easy-to-copy (one-click copy button) or restricted (reveal-only, no copy button).

Secrets are encrypted at rest with AES-256-GCM using `VAULT_ENCRYPTION_KEY`:

```bash
openssl rand -hex 32   # set as VAULT_ENCRYPTION_KEY in production
```

In local development you can leave it unset - on first use a key is generated and saved to `db/vault.key` (gitignored) so secrets stay decryptable across restarts.

> [!CAUTION]
> Rotating or losing `VAULT_ENCRYPTION_KEY` (or `db/vault.key` in dev) makes every existing vault entry permanently unrecoverable. Back it up alongside `BETTER_AUTH_SECRET`.

## Project Structure

```
dashboard/
├── src/
│   ├── app/                    # Next.js App Router - pages and API routes
│   │   ├── (auth)/             # Login / register pages (unauthenticated layout)
│   │   ├── (dashboard)/        # Authenticated dashboard pages + shared layout
│   │   │   ├── layout.tsx      # Auth gate + sidebar/topnav shell
│   │   │   ├── dashboard/      # Member overview page
│   │   │   ├── orders/         # Order submission + history
│   │   │   ├── api-keys/       # API key management
│   │   │   ├── minecraft/      # Minecraft status, whitelist requests, leaderboard
│   │   │   ├── headscale/      # Network join requests
│   │   │   └── admin/          # Admin-only pages (order queue, users, etc.)
│   │   ├── api/                # Route handlers
│   │   │   ├── service/        # External service endpoints (e.g. API key verify)
│   │   │   └── minecraft/      # Internal endpoints (status, leaderboard)
│   │   └── bluemap/            # BlueMap reverse proxy (catch-all, forwards to BLUEMAP_URL)
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
> `src/lib/db/auth-schema.ts` is owned by better-auth. Do **not** edit it directly - your changes will be overwritten the next time better-auth regenerates it. To customize auth-related columns, go through `src/lib/auth.ts`.

## Database

The app uses a **single SQLite file** on disk. All queries go through [Drizzle ORM](https://orm.drizzle.team) - there is no separate database server to manage.

### Schema overview

| Table                    | Description                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `user`                   | Registered members. `role` is `"admin"` or `"member"`. `isActive = false` blocks dashboard access without deleting the account. |
| `session`                | Active auth sessions - managed by better-auth, don't touch.                                                                     |
| `account`                | Auth provider records - managed by better-auth, don't touch.                                                                    |
| `verification`           | Email verification tokens - managed by better-auth, don't touch.                                                                |
| `team`                   | The 6 robot sub-teams. Seeded once; not user-editable through the UI.                                                           |
| `orders`                 | Part order requests. Status flows: `pending → approved / rejected → ordered`.                                                   |
| `api_key`                | Hashed service API keys issued to members. Only the prefix and hash are stored - the raw key is shown once on creation.         |
| `minecraft_whitelist`    | Minecraft username whitelist requests. `addedDirectly` marks entries added by admins without a member request.                  |
| `headscale_join_request` | Requests to join the VPN. Approved requests still require manual action in Headscale CLI.                                       |

### Inspecting the database

```bash
sqlite3 db/dashboard.db
```

Useful commands inside the SQLite shell:

```sql
.tables                                          -- list all tables
.schema orders                                   -- show CREATE TABLE statement
SELECT * FROM user;
SELECT * FROM orders WHERE status = 'pending';
datetime(created_at / 1000, 'unixepoch')         -- convert ms timestamp to readable date
.quit
```

> [!NOTE]
> All timestamps are stored as **millisecond integers** (`timestamp_ms`). Divide by 1000 or use `datetime(col / 1000, 'unixepoch')` when querying raw SQL.

### Changing the schema

```bash
# 1. Edit src/lib/db/schema.ts
# 2. Generate the migration
pnpm db:generate
# 3. Apply it locally
pnpm db:migrate
# 4. Commit schema.ts and the new file in drizzle/ together
```

> [!WARNING]
> Never edit files inside `drizzle/` after they have been committed. Drizzle checksums each file and will refuse to run migrations if it detects manual edits.

## Scripts

| Command             | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Start the dev server with hot reload                     |
| `pnpm build`        | Production build                                         |
| `pnpm start`        | Start the production server (requires a prior `build`)   |
| `pnpm lint`         | Run ESLint                                               |
| `pnpm format`       | Auto-format all files with Prettier                      |
| `pnpm format:check` | Check formatting without writing (used in CI)            |
| `pnpm db:generate`  | Generate migrations from schema changes                  |
| `pnpm db:migrate`   | Apply all pending migrations                             |
| `pnpm db:seed`      | Seed the 6 teams + admin user (idempotent)               |
| `pnpm db:studio`    | Open Drizzle Studio — visual database browser (dev only) |

## Deployment

See **[DEPLOY.md](DEPLOY.md)** for full production setup - Jetson Xavier (ARM64), systemd service, Cloudflare Tunnel, and Headscale configuration.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for workflow, branch naming, code style, and PR guidelines.
