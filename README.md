# TrickFire Dashboard

Internal dashboard for [TrickFire Robotics](https://trickfirerobotics.com). Manages team orders, admin workflows, Minecraft server monitoring, and API key issuance for simulation scripts.

Runs on the lab's NVIDIA Jetson Xavier at `https://dashboard.trickfirerobotics.com` behind a Cloudflare Tunnel.

## Tech stack

- **Framework** — Next.js 15 (App Router, standalone output)
- **Database** — SQLite via Drizzle ORM + better-sqlite3
- **Auth** — better-auth with session management
- **UI** — Tailwind CSS v4, shadcn/ui, Lucide icons
- **Package manager** — pnpm

## Prerequisites

- Node.js 22+
- pnpm (`corepack enable pnpm`)

## Local setup

```bash
git clone <repo-url>
cd dashboard
pnpm install
```

Copy the environment template and fill in values:

```bash
cp .env.example .env.local
```

| Variable                | Description                                 |
| ----------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`   | App origin, e.g. `http://localhost:3000`    |
| `BETTER_AUTH_SECRET`    | Random secret — `openssl rand -hex 32`      |
| `BETTER_AUTH_URL`       | Same as `NEXT_PUBLIC_APP_URL`               |
| `DATABASE_PATH`         | Path to SQLite file, e.g. `db/dashboard.db` |
| `MINECRAFT_SERVER_HOST` | Minecraft server hostname or IP             |
| `MINECRAFT_SERVER_PORT` | Minecraft server port (default `25565`)     |
| `SEED_ADMIN_EMAIL`      | Admin account email for seeding             |
| `SEED_ADMIN_PASSWORD`   | Admin account password for seeding          |
| `SEED_ADMIN_NAME`       | Admin display name for seeding              |

Set up and seed the database:

```bash
mkdir -p db
pnpm db:migrate
pnpm db:seed
```

Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the seeded admin credentials.

## Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start dev server                        |
| `pnpm build`        | Production build                        |
| `pnpm start`        | Start production server                 |
| `pnpm lint`         | Run ESLint                              |
| `pnpm format`       | Format all files with Prettier          |
| `pnpm format:check` | Check formatting without writing        |
| `pnpm db:generate`  | Generate migrations from schema changes |
| `pnpm db:migrate`   | Apply pending migrations                |
| `pnpm db:seed`      | Seed teams and admin user (idempotent)  |

## Deployment

See [DEPLOY.md](DEPLOY.md) for full instructions covering the Jetson Xavier setup, systemd service, and Cloudflare Tunnel.
