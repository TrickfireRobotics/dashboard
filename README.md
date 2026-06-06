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
| Network         | [Tailscale](https://tailscale.com) — shared tailnet, managed via Tailscale API                                       |
| Package manager | [`pnpm`](https://pnpm.io/)                                                                                           |

## Local Development

### Dev Container

Open the project in [VS Code](https://code.visualstudio.com/) with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed, then run **Dev Containers: Reopen in Container** from the command palette. The container automatically installs dependencies, copies `.env.example` → `.env.local`, and seeds the database. Once it finishes, run `pnpm dev` and open `http://localhost:3000`.

### Local Setup

#### Prerequisites

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

| Variable                      | Description                                                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`         | Public origin of the app, e.g. `http://localhost:3000`                                                                                                                                                          |
| `BETTER_AUTH_SECRET`          | Random secret for signing sessions — generate with `openssl rand -hex 32`                                                                                                                                       |
| `BETTER_AUTH_URL`             | Same value as `NEXT_PUBLIC_APP_URL`                                                                                                                                                                             |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated extra origins allowed to make auth requests, e.g. `http://192.168.1.50:3000`. Required when accessing the dev server from another machine on the LAN.                                           |
| `DATABASE_PATH`               | Path to the SQLite file, e.g. `./db/dashboard.db`                                                                                                                                                               |
| `VAULT_ENCRYPTION_KEY`        | AES-256 key (hex) encrypting API Key Vault secrets at rest — generate with `openssl rand -hex 32`. **Required in production.** In local dev, if unset, a key is auto-generated and persisted to `db/vault.key`. |
| `RESEND_API_KEY`              | API key from [Resend](https://resend.com) for transactional email                                                                                                                                               |
| `EMAIL_FROM`                  | Sender shown in outgoing emails, e.g. `TrickFire Robotics <noreply@trickfirerobotics.com>`                                                                                                                      |
| `MINECRAFT_SERVER_HOST`       | Hostname/IP of the Minecraft server (default `localhost`)                                                                                                                                                       |
| `MINECRAFT_SERVER_PORT`       | Query port of the Minecraft server (default `25565`)                                                                                                                                                            |
| `MINECRAFT_SERVER_PATH`       | Absolute path to the Minecraft server directory — used to detect if the server is installed                                                                                                                     |
| `MINECRAFT_WORLD_PATH`        | Absolute path to the Minecraft world directory. Used to read per-player stat files for the playtime leaderboard.                                                                                                |
| `MINECRAFT_RCON_PORT`         | RCON port (default `25575`). Must match `rcon.port` in `server.properties`.                                                                                                                                     |
| `MINECRAFT_RCON_PASSWORD`     | RCON password. Must match `rcon.password` in `server.properties`.                                                                                                                                               |
| `MINECRAFT_BOT_NAMES`         | Comma-separated list of carpet bot names, optionally with a custom skin URL: `BotA:https://s.namemc.com/i/abc123.png`. Bots are tagged in the UI.                                                               |
| `BLUEMAP_URL`                 | Internal URL of the BlueMap web server, e.g. `http://localhost:8100`. The dashboard proxies this at `/bluemap` so it's accessible without exposing a second port.                                               |
| `TAILSCALE_API_KEY`           | API key from the Tailscale admin console (Settings → Keys). Powers the Network tab.                                                                                                                             |
| `TAILSCALE_TAILNET`           | Tailnet name, e.g. `trickfirerobotics.com`. Use `-` to default to the tailnet that owns the API key.                                                                                                            |
| `ONSHAPE_BASE_URL`            | OnShape API base URL, e.g. `https://cad.onshape.com/api`                                                                                                                                                        |
| `ONSHAPE_ACCESS_KEY`          | OnShape API access key                                                                                                                                                                                          |
| `ONSHAPE_SECRET_KEY`          | OnShape API secret key                                                                                                                                                                                          |
| `ONSHAPE_COMPANY_ID`          | Optional. Pin requests to a specific OnShape company — auto-detected from the access key if omitted.                                                                                                            |
| `SEED_ADMIN_EMAIL`            | Email for the seeded admin account                                                                                                                                                                              |
| `SEED_ADMIN_PASSWORD`         | Password for the seeded admin account                                                                                                                                                                           |
| `SEED_ADMIN_NAME`             | Display name for the seeded admin                                                                                                                                                                               |

> [!TIP]
> Most variables are optional for local dev. The app degrades gracefully: Minecraft cards show "offline", the leaderboard and map show an unavailable state, email is skipped, and the Network tab shows an error state. The only var you strictly need to set is `BETTER_AUTH_SECRET`.

> [!CAUTION]
> Never commit `.env.local` or `.env.production`. The `BETTER_AUTH_SECRET` value lets anyone forge session tokens — if it leaks, rotate it immediately by changing the value and restarting the server (all existing sessions are invalidated).

### API Key Vault

The **API Keys** page is a secret vault: admins store shared credentials (third-party API keys, service logins). Two layers of access apply:

- **Page visibility** — the **Vault access** toggle on the Users admin page controls who can open the vault page at all (admins always can).
- **Per-secret access** — reading any individual secret requires a **per-person, per-entry** grant, set from the entry's **Manage access** action (the key icon in the row's Actions). Admins always have access; the global Vault-access toggle does **not** grant secret access on its own.

Each entry is either a _login_ or an _api_key_:

- **Login** (username + password) — revealed and copied in the browser on demand, for granted users. Served by `GET /api/vault/{id}/reveal`.
- **API key** — the value is **never shown in the dashboard**. It is retrieved only through an authenticated endpoint (see below), for granted users.

#### Fetching an API key — `GET /api/vault/{id}/key`

Authenticated by the caller's **dashboard session** (login cookie). Returns the key only if the logged-in user is an admin or has been granted access to that entry.

| Status | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| `200`  | `{ "name": "Resend", "key": "re_live_..." }`                                    |
| `401`  | Not logged in (no/invalid session)                                              |
| `403`  | Logged in but no per-person grant for this entry                                |
| `404`  | Entry doesn't exist, or it is a `login` entry (use the reveal endpoint instead) |

Because auth is the session cookie, scripts call it with that cookie. From a logged-in browser you can open the URL directly; from a script, pass the session cookie:

```bash
# Copy the "better-auth.session_token" cookie from your logged-in browser.
curl -s https://dashboard.example.com/api/vault/12/key \
  -H "Cookie: better-auth.session_token=<your-session-cookie>"
# -> {"name":"Resend","key":"re_live_..."}
```

> [!NOTE]
> This endpoint is session-authenticated by design — there is no standalone machine token. A script must reuse a real user's session cookie, and that user must hold a per-person grant for the entry.

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
| `vault_entry`            | API Key Vault entries (shared `login` / `api_key` credentials), AES-256-GCM encrypted at rest. See the API Key Vault section.   |
| `vault_entry_access`     | Per-person read grants for vault entries. A row `(entry_id, user_id)` lets that user read that one secret (login or api_key).   |
| `minecraft_whitelist`    | Minecraft username whitelist requests. `addedDirectly` marks entries added by admins without a member request.                  |
| `headscale_join_request` | Requests to join the Tailscale network. Approved requests still require manual action in the Tailscale admin console.           |

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

| Command             | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`          | Start the dev server with hot reload                                       |
| `pnpm build`        | Production build                                                           |
| `pnpm start`        | Start the production server (requires a prior `build`)                     |
| `pnpm lint`         | Run ESLint                                                                 |
| `pnpm format`       | Auto-format all files with Prettier                                        |
| `pnpm format:check` | Check formatting without writing (used in CI)                              |
| `pnpm db:generate`  | Generate migrations from schema changes                                    |
| `pnpm db:migrate`   | Apply all pending migrations                                               |
| `pnpm db:seed`      | Seed the 6 teams + admin user (idempotent)                                 |
| `pnpm db:reset`     | Drop and recreate the local database. **Blocked in production** by a guard |
| `pnpm db:studio`    | Open Drizzle Studio — visual database browser (dev only)                   |

## Deployment

See **[DEPLOY.md](DEPLOY.md)** for full production setup - Jetson Xavier (ARM64), systemd service, Cloudflare Tunnel, and Headscale configuration.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for workflow, branch naming, code style, and PR guidelines.
