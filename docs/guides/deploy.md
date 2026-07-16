---
title: Deployment
description: Production setup on the server, updating an existing deployment, backups, and troubleshooting.
---

# Deploying TrickFire Dashboard

Production runs on a Debian AMD64 server behind a Cloudflare Tunnel. The app is built with `output: "standalone"` and uses a local SQLite database.

All steps are run **on the server** unless noted otherwise.

## Table of Contents

1. [Initial Setup](#1-initial-setup)
2. [Get the Code](#2-get-the-code)
3. [Configure Environment](#3-configure-environment)
4. [Database](#4-database)
5. [Build](#5-build)
6. [Systemd Service](#6-systemd-service)
7. [GitHub Actions Runner](#7-github-actions-runner)
8. [Cloudflare Tunnel](#8-cloudflare-tunnel)
9. [Uptime Monitoring](#9-uptime-monitoring)

- [Updating an Existing Deployment](#updating-an-existing-deployment)
- [Backups](#backups)
- [Database Safety](#database-safety)
- [Troubleshooting](#troubleshooting)

---

## 1. Initial Setup

```bash
node --version   # confirm Node.js is installed (see .nvmrc for target version)

sudo corepack enable pnpm
pnpm --version

# C++ toolchain for compiling better-sqlite3's native addon
sudo apt-get update && sudo apt-get install -y build-essential python3
```

## 2. Get the Code

```bash
git clone <repo-url> /home/trickfire/dashboard
cd /home/trickfire/dashboard
pnpm install --frozen-lockfile
```

## 3. Configure Environment

Create `/home/trickfire/dashboard/.env.production` using `.env.example` as a template. Minimum required values:

```env
NEXT_PUBLIC_APP_URL=https://dashboard.trickfirerobotics.com
BETTER_AUTH_URL=https://dashboard.trickfirerobotics.com
BETTER_AUTH_SECRET=<openssl rand -hex 32>
VAULT_ENCRYPTION_KEY=<openssl rand -hex 32>

DATABASE_PATH=/home/trickfire/db/dashboard.db

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=TrickFire Robotics <noreply@trickfirerobotics.com>
```

For Tailscale, Minecraft, and Pl3xMap env vars see [integrations.md](integrations.md).

> [!NOTE]
> `NODE_ENV=production` is set in the systemd service file - do not add it to `.env.production`. Next.js uses it to decide which env files to load; putting it in the file it is trying to load creates a circular dependency.

> [!CAUTION]
> Keep `.env.production` off git. `BETTER_AUTH_SECRET` lets anyone forge session tokens - rotate it immediately if it leaks (changing the value invalidates all sessions). Losing `VAULT_ENCRYPTION_KEY` makes every vault entry permanently unrecoverable - back it up separately.

## 4. Database

```bash
mkdir -p /home/trickfire/db
pnpm exec drizzle-kit migrate
pnpm db:seed
```

The seed is idempotent - safe to run again without creating duplicates.

## 5. Build

```bash
pnpm build

# Copy static assets into the standalone output - required after every build
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
```

> [!WARNING]
> If you skip the `cp` steps the app starts but all static assets (JS, CSS, images) return 404. This is the most common cause of "login works but the page looks broken."

The entrypoint is `.next/standalone/server.js`. `better-sqlite3` is declared as a `serverExternalPackages` module, so it loads from `node_modules` at runtime rather than being bundled - keep `node_modules` present alongside the standalone output.

## 6. Systemd Service

Create `/etc/systemd/system/trickfire-dashboard.service`:

```ini
[Unit]
Description=TrickFire Robotics Dashboard
After=network.target

[Service]
Type=simple
User=trickfire
WorkingDirectory=/home/trickfire/dashboard
EnvironmentFile=/home/trickfire/dashboard/.env.production
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node /home/trickfire/dashboard/.next/standalone/server.js
TimeoutStopSec=10
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> [!IMPORTANT]
> Bind to `127.0.0.1`, not `0.0.0.0`. The Cloudflare Tunnel is the only entry point - binding to all interfaces would expose the app on the local network without TLS.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now trickfire-dashboard
sudo systemctl status trickfire-dashboard
journalctl -u trickfire-dashboard -f
```

## 7. GitHub Actions Runner

Every push to `main` runs the deploy automatically via a self-hosted runner. This replaces the manual update steps for day-to-day releases.

### Install the runner

The runner must run as the `trickfire` user.

```bash
sudo -u trickfire -s
mkdir -p /home/trickfire/actions-runner && cd /home/trickfire/actions-runner
```

Go to the GitHub repo → **Settings → Actions → Runners → New self-hosted runner**, select **Linux / AMD64**, and follow the download and configure commands shown there. When prompted for labels, accept the default (`self-hosted`).

Install as a systemd service:

```bash
# Still as the trickfire user
sudo ./svc.sh install trickfire
sudo ./svc.sh start
sudo systemctl status actions.runner.*
```

### Allow the runner to restart services

The deploy script calls `sudo systemctl restart trickfire-dashboard`. Grant passwordless sudo for this and the Minecraft service:

```bash
sudo visudo -f /etc/sudoers.d/trickfire-runner
```

Add:

```
trickfire ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart trickfire-dashboard
trickfire ALL=(ALL) NOPASSWD: /usr/bin/systemctl start minecraft
trickfire ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop minecraft
```

Push a commit to `main` and watch the **Deploy** workflow in the GitHub Actions tab to verify.

> [!NOTE]
> Deploys are serialised - if two merges land in quick succession, the second waits for the first to finish.

## 8. Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create trickfire-dashboard
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-uuid>
credentials-file: /home/trickfire/.cloudflared/<tunnel-uuid>.json

ingress:
    - hostname: dashboard.trickfirerobotics.com
      service: http://127.0.0.1:3000
    - service: http_status:404
```

```bash
cloudflared tunnel route dns trickfire-dashboard dashboard.trickfirerobotics.com
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

> [!NOTE]
> The service API endpoint (`POST /api/service/verify`, used by simulation scripts) is reachable through the same tunnel and is IP-rate-limited via `x-forwarded-for` / `cf-connecting-ip` headers injected by Cloudflare.

## 9. Uptime Monitoring

A Cloudflare Worker (`health/`) pings `/api/health` every 5 minutes and posts a Discord alert if the dashboard is unreachable. It runs on Cloudflare's edge and is unaffected by server outages.

```bash
cd health
pnpm dlx wrangler deploy
pnpm dlx wrangler secret put DISCORD_WEBHOOK_URL   # paste the webhook URL when prompted
```

The HTTP handler also responds to a direct request to the Worker URL, useful for triggering an instant check during testing.

To update the Discord user IDs that get pinged on failure, edit `PING_IDS` in `health/src/index.js` and redeploy.

---

## Updating an Existing Deployment

> [!TIP]
> In practice, merging to `main` triggers the GitHub Actions runner to do all of this automatically. These manual steps are a fallback for when the runner is unavailable.

```bash
cd /home/trickfire/dashboard
git pull
pnpm install --frozen-lockfile      # recompiles native deps if versions changed
pnpm exec drizzle-kit migrate       # apply any new schema migrations
pnpm build
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
sudo systemctl restart trickfire-dashboard
```

Check logs immediately after restarting:

```bash
journalctl -u trickfire-dashboard -f
```

## Backups

All application state is the SQLite file at `/home/trickfire/db/dashboard.db`. A backup script and nightly cron job are already installed on the server.

|           |                                        |
| --------- | -------------------------------------- |
| Script    | `/home/trickfire/scripts/backup-db.sh` |
| Schedule  | Daily at 02:00 (server local time)     |
| Retention | 14 days                                |
| Log       | `/home/trickfire/backups/backup.log`   |

```bash
~/scripts/backup-db.sh   # run a manual backup at any time
crontab -l               # verify the cron entry
```

### Restore from backup

```bash
sudo systemctl stop trickfire-dashboard
cp /home/trickfire/backups/dashboard-<date>.db /home/trickfire/db/dashboard.db
sudo systemctl start trickfire-dashboard
```

## Database Safety

`pnpm db:reset` cannot run in production. A `predb:reset` lifecycle hook in `package.json` checks `NODE_ENV` and exits before the reset executes. The database directory (`/home/trickfire/db/`) is also outside the application directory, so `rm -rf ~/dashboard` won't touch it.

## Troubleshooting

<details>
<summary><strong>Could not locate the bindings file / invalid ELF header</strong></summary>

`better-sqlite3` was compiled on a different machine or architecture. Recompile on the server:

```bash
cd /home/trickfire/dashboard
pnpm rebuild better-sqlite3
```

If that fails, do a clean reinstall:

```bash
rm -rf node_modules && pnpm install --frozen-lockfile
```

</details>

<details>
<summary><strong>Login works but assets (JS/CSS/images) return 404</strong></summary>

The post-build copy step was skipped:

```bash
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
sudo systemctl restart trickfire-dashboard
```

</details>

<details>
<summary><strong>Login freezes or returns 403 "Invalid origin"</strong></summary>

In production this shouldn't happen - all traffic goes through the Cloudflare Tunnel. If you're testing the production build from a second machine on the LAN, add its address to `BETTER_AUTH_TRUSTED_ORIGINS`:

```env
BETTER_AUTH_TRUSTED_ORIGINS=http://192.168.1.50:3000
```

Restart to pick up the change. Multiple origins can be comma-separated.

</details>

<details>
<summary><strong>Network tab shows an error</strong></summary>

1. Confirm `TAILSCALE_API_KEY` is set in `.env.production` and hasn't expired.
2. Rotate if needed: Tailscale admin console → **Settings → Keys → Generate access token**.
3. Restart after updating: `sudo systemctl restart trickfire-dashboard`

</details>

<details>
<summary><strong>Service fails to start</strong></summary>

```bash
journalctl -u trickfire-dashboard -n 100 --no-pager
```

Common causes: missing `.env.production`, `DATABASE_PATH` pointing to a directory that doesn't exist, or a failed migration.

</details>
