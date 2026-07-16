---
title: Getting Started
description: Run the dashboard locally for the first time.
---

The TrickFire Dashboard is a [Next.js](https://nextjs.org/) app with a local SQLite database. This page gets you from a fresh clone to a logged-in session. If you've never worked on a TypeScript/Next.js app before, read [Next.js & TypeScript](/tech-stack/nextjs-typescript/) alongside this page - it explains what all the pieces below actually are.

## Option A - Dev Container (recommended if you're new to the stack)

Open the repo in [VS Code](https://code.visualstudio.com/) with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed, then run **Dev Containers: Reopen in Container** from the command palette.

The container automatically:

1. Installs Node.js and `pnpm` at the pinned versions.
2. Runs `pnpm install`.
3. Copies `.env.example` to `.env.local`.
4. Runs the database migrations and seeds sample data.

Once it finishes, run:

```bash title="Terminal"
pnpm dev
```

and open `http://localhost:3000`.

## Option B - Local Setup

**Prerequisites:**

- Node.js ≥ 20 (see `.nvmrc` for the exact version this project targets)
- [`pnpm`](https://pnpm.io/) (enable via `corepack enable pnpm` if you don't have it)
- A C++ build toolchain - only needed if `better-sqlite3` doesn't have a prebuilt binary for your OS/architecture

```bash title="Terminal"
pnpm install
cp .env.example .env.local   # then set BETTER_AUTH_SECRET at minimum
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000` and log in with whatever you set as `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env.local`.

:::tip
Almost every environment variable is optional for local dev - the app is written to degrade gracefully when an integration isn't configured (Minecraft status just shows "offline", the Network tab shows empty, etc.). `BETTER_AUTH_SECRET` is the only one you must set yourself; generate it with `openssl rand -hex 32`.
:::

## What "seeding" gives you

`pnpm db:seed` populates the local database with the 6 TrickFire subteams, an admin user (from `SEED_ADMIN_*`), and a handful of sample orders across every status, so the UI isn't empty on first run. It's idempotent - safe to re-run any time.

## Where to go next

- [Architecture Overview](/architecture/) - how the codebase is organized and how a request flows through it.
- [Tech Stack](/tech-stack/nextjs-typescript/) - what every framework/library is and how this project uses it.
- [Development Setup](/guides/development/) - the full command reference, environment variable table, CI/git-hook behavior, and the API key vault.
