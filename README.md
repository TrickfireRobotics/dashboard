# TrickFire Dashboard

Internal dashboard for [TrickFire Robotics](https://trickfirerobotics.com). Manages team orders, admin workflows, and API key issuance and similar/

Runs on the lab's server at `https://dashboard.trickfirerobotics.com` behind a Cloudflare Tunnel.

## Tech stack

- **Framework** - Next.js 15 (App Router, standalone output)
- **Database** - SQLite via Drizzle ORM + better-sqlite3
- **Auth** - better-auth with session management
- **UI** - Tailwind CSS v4, shadcn/ui, Lucide icons
- **Package manager** - pnpm

## Environment

There is a example file at `.env.example`. Copy it to `.env.local` and configure that file. Here are the explanations of each environmental variable:

| Variable              | Description                                 |
| --------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_APP_URL` | App origin, e.g. `http://localhost:3000`    |
| `BETTER_AUTH_SECRET`  | Random secret - `openssl rand -hex 32`      |
| `BETTER_AUTH_URL`     | Same as `NEXT_PUBLIC_APP_URL`               |
| `DATABASE_PATH`       | Path to SQLite file, e.g. `db/dashboard.db` |
| `SEED_ADMIN_EMAIL`    | Admin account email for seeding             |
| `SEED_ADMIN_PASSWORD` | Admin account password for seeding          |
| `SEED_ADMIN_NAME`     | Admin display name for seeding              |

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

See [DEPLOY.md](DEPLOY.md) for full instructions covering server machine setup, systemd service, and Cloudflare Tunnel.
