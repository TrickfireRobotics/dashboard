# TrickFire Dashboard

Internal portal for [TrickFire Robotics](https://trickfirerobotics.com). Members submit part orders and Minecraft whitelist requests; admins review and action them. A service API used by simulation scripts is also exposed through the same server.

## Tech Stack

| Layer           | Choice                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Next.js 15](https://nextjs.org/) - App Router, React Server Components, `output: "standalone"`                      |
| Database        | SQLite via [Drizzle ORM](https://orm.drizzle.team) + [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)  |
| Auth            | [better-auth](https://www.better-auth.com) - email/password, session cookies                                         |
| UI              | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com), [Lucide icons](https://lucide.dev/) |
| Email           | [Resend](https://resend.com)                                                                                         |
| Network         | [Tailscale](https://tailscale.com) - shared tailnet, managed via Tailscale API                                       |
| Package manager | [`pnpm`](https://pnpm.io/)                                                                                           |

## Local Development

### Option A - Dev Container

Open in [VS Code](https://code.visualstudio.com/) with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension, then run **Dev Containers: Reopen in Container**. Dependencies install automatically, `.env.example` is copied to `.env.local`, and the database is seeded. Run `pnpm dev` and open `http://localhost:3000`.

### Option B - Local Setup

**Prerequisites:** Node.js ≥ 20, `pnpm`, a C++ build toolchain (only if `better-sqlite3` has no prebuilt for your platform).

```bash
pnpm install
cp .env.example .env.local   # set BETTER_AUTH_SECRET at minimum
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000` and log in with the credentials from `SEED_ADMIN_*` in `.env.local`.

> [!TIP]
> Most env vars are optional for local dev - the app degrades gracefully. `BETTER_AUTH_SECRET` is the only one you must set. Generate it with `openssl rand -hex 32`.

## Environment Variables

| Variable                      | Required  | Description                                                                                                         |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`          | **Yes**   | Session signing secret - `openssl rand -hex 32`                                                                     |
| `VAULT_ENCRYPTION_KEY`        | Prod only | AES-256 key for vault secrets - `openssl rand -hex 32`                                                              |
| `NEXT_PUBLIC_APP_URL`         | No        | Public origin, e.g. `http://localhost:3000`                                                                         |
| `BETTER_AUTH_URL`             | No        | Same as `NEXT_PUBLIC_APP_URL`                                                                                       |
| `BETTER_AUTH_TRUSTED_ORIGINS` | No        | Extra origins allowed to make auth requests (needed when accessing the dev server from a second machine on the LAN) |
| `DATABASE_PATH`               | No        | Path to the SQLite file (default: `./db/dashboard.db`)                                                              |
| `RESEND_API_KEY`              | No        | [Resend](https://resend.com) API key for transactional email                                                        |
| `EMAIL_FROM`                  | No        | Sender address, e.g. `TrickFire Robotics <noreply@trickfirerobotics.com>`                                           |
| `MINECRAFT_SERVER_HOST`       | No        | Minecraft server hostname/IP (default: `localhost`)                                                                 |
| `MINECRAFT_SERVER_PORT`       | No        | Minecraft query port (default: `25565`)                                                                             |
| `MINECRAFT_SERVER_PATH`       | No        | Absolute path to the Minecraft server directory                                                                     |
| `MINECRAFT_WORLD_PATH`        | No        | Absolute path to the world directory (for the playtime leaderboard)                                                 |
| `MINECRAFT_RCON_PORT`         | No        | RCON port (default: `25575`)                                                                                        |
| `MINECRAFT_RCON_PASSWORD`     | No        | RCON password                                                                                                       |
| `MINECRAFT_BOT_NAMES`         | No        | Comma-separated carpet bot names, optionally with a skin URL: `BotA:https://skin-url.png`                           |
| `PL3XMAP_URL`                 | No        | Internal URL of the Pl3xMap web server, e.g. `http://localhost:8080`                                                |
| `TAILSCALE_API_KEY`           | No        | Tailscale API key (admin console → Settings → Keys)                                                                 |
| `TAILSCALE_TAILNET`           | No        | Tailnet name, or `-` to auto-detect from the API key                                                                |
| `ONSHAPE_BASE_URL`            | No        | OnShape API base URL                                                                                                |
| `ONSHAPE_ACCESS_KEY`          | No        | OnShape access key                                                                                                  |
| `ONSHAPE_SECRET_KEY`          | No        | OnShape secret key                                                                                                  |
| `ONSHAPE_COMPANY_ID`          | No        | OnShape company ID (auto-detected from the access key if omitted)                                                   |
| `SEED_ADMIN_EMAIL`            | No        | Email for the seeded admin account                                                                                  |
| `SEED_ADMIN_PASSWORD`         | No        | Password for the seeded admin account                                                                               |
| `SEED_ADMIN_NAME`             | No        | Display name for the seeded admin                                                                                   |
| `GITHUB_ORG`                  | No        | GitHub organization name (e.g. `trickfirerobotics`) — enables the GitHub admin page                                 |
| `GITHUB_TOKEN`                | No        | Fine-grained PAT with **Organization → Members: Read and write** permission                                         |

> [!CAUTION]
> Never commit `.env.local` or `.env.production`. `BETTER_AUTH_SECRET` lets anyone forge session tokens - if it leaks, rotate it immediately by changing the value and restarting the server (all existing sessions are invalidated). Rotating or losing `VAULT_ENCRYPTION_KEY` makes every existing vault entry permanently unrecoverable - back it up.

## API Key Vault

The **API Keys** page is a shared credential vault where admins store third-party API keys and service logins. Two layers of access apply:

- **Page visibility** - the **Vault access** toggle on the Users admin page controls who can open the vault at all (admins always can).
- **Per-secret access** - reading any individual secret requires a per-person grant set from the entry's **Manage access** action. The global Vault-access toggle does not grant secret access on its own.

Each entry is either a `login` (username + password, revealed in the browser on demand) or an `api_key` (never shown in the UI - retrieved only via the API endpoint below).

### Fetching an API key - `GET /api/vault/{id}/key`

Authenticated by the caller's dashboard session cookie. Returns the key only if the user is an admin or has been granted access.

| Status | Meaning                                                                            |
| ------ | ---------------------------------------------------------------------------------- |
| `200`  | `{ "name": "Resend", "key": "re_live_..." }`                                       |
| `401`  | Not logged in                                                                      |
| `403`  | Logged in but no access grant for this entry                                       |
| `404`  | Entry doesn't exist, or it is a `login` (use `GET /api/vault/{id}/reveal` instead) |

```bash
curl -s https://dashboard.trickfirerobotics.com/api/vault/12/key \
  -H "Cookie: better-auth.session_token=<your-session-cookie>"
```

Secrets are encrypted at rest with AES-256-GCM using `VAULT_ENCRYPTION_KEY`. In local dev, if that variable is unset, a key is auto-generated and saved to `db/vault.key` (gitignored).

## Commands

| Command             | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Start the dev server with hot reload                             |
| `pnpm build`        | Production build                                                 |
| `pnpm start`        | Start the production server (requires a prior build)             |
| `pnpm lint`         | Run ESLint                                                       |
| `pnpm format`       | Auto-format all files with Prettier                              |
| `pnpm format:check` | Check formatting without writing (used in CI)                    |
| `pnpm db:generate`  | Generate migrations from schema changes                          |
| `pnpm db:migrate`   | Apply all pending migrations                                     |
| `pnpm db:seed`      | Seed the 6 teams + admin user (idempotent)                       |
| `pnpm db:reset`     | Drop and recreate the local database (**blocked in production**) |
| `pnpm db:studio`    | Open Drizzle Studio - visual database browser (dev only)         |

## Docs

- [**Deployment guide**](docs/deploy.md) - production setup, updating, backups, troubleshooting
- [**Integrations**](docs/integrations.md) - Tailscale, Minecraft server, Pl3xMap
- [**Server hardening**](docs/server-hardening.md) - SSH, firewall, fail2ban, auto-updates
- [**Contributing**](CONTRIBUTING.md) - workflow, branch naming, code style, PR guidelines
