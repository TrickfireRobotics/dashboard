# Deploying the TrickFire Dashboard

Production runs on a Debian AMD64 server behind a Cloudflare Tunnel. It is a Next.js 15 app using `output: "standalone"` with a local SQLite database (`better-sqlite3`).

All steps below are run **on the server** unless noted otherwise.

## Table of Contents

1. [Initial Setup](#1-initial-setup)
2. [Get the Code](#2-get-the-code)
3. [Configure Environment](#3-configure-environment)
4. [Database: Migrate and Seed](#4-database-migrate-and-seed)
5. [Build](#5-build)
6. [Run as a systemd Service](#6-run-as-a-systemd-service)
7. [Automated Deploys (GitHub Actions)](#7-automated-deploys-github-actions)
8. [Cloudflare Tunnel](#8-cloudflare-tunnel)
9. [Uptime Monitoring](#9-uptime-monitoring)
10. [Tailscale Setup](#10-tailscale-setup)
11. [Headscale Setup](#11-headscale-setup)
12. [Minecraft Server Setup](#12-minecraft-server-setup)
13. [BlueMap Setup](#13-bluemap-setup)
12. [Updating an Existing Deployment](#updating-an-existing-deployment)
13. [Backups](#backups)
14. [Database Safety](#database-safety)
15. [Troubleshooting](#troubleshooting)

---

## 1. Initial Setup

```bash
# Confirm Node.js is installed (see .nvmrc for the target major version)
node --version

# Enable pnpm via corepack
sudo corepack enable pnpm
pnpm --version

# Build toolchain for compiling better-sqlite3's native addon
sudo apt-get update
sudo apt-get install -y build-essential python3
```

## 2. Get the Code

```bash
git clone <repo-url> /home/trickfire/dashboard
cd /home/trickfire/dashboard

# Installs deps and compiles better-sqlite3's native addon
pnpm install --frozen-lockfile
```

## 3. Configure Environment

1. Create `/home/trickfire/dashboard/.env.production` - use `.env.example` as the template.
2. Generate the auth secret:

    ```bash
    openssl rand -hex 32
    ```

### Key values for production

```env
NEXT_PUBLIC_APP_URL=https://dashboard.trickfirerobotics.com
BETTER_AUTH_URL=https://dashboard.trickfirerobotics.com
BETTER_AUTH_SECRET=<generated above>
VAULT_ENCRYPTION_KEY=<generate a second value: openssl rand -hex 32>

DATABASE_PATH=/home/trickfire/db/dashboard.db

# Minecraft
MINECRAFT_SERVER_HOST=<host or LAN IP of the Minecraft server>
MINECRAFT_SERVER_PORT=25565
MINECRAFT_WORLD_PATH=/home/trickfire/minecraft/world
MINECRAFT_BOT_NAMES=BotA,BotB         # comma-separated; append :SkinURL for a custom skin
BLUEMAP_URL=http://localhost:8100

# Tailscale
TAILSCALE_API_KEY=<from Tailscale admin console → Settings → Keys>
TAILSCALE_TAILNET=-

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=TrickFire Robotics <noreply@trickfirerobotics.com>
```

> [!NOTE]
> `NODE_ENV=production` is set directly in the systemd service file - do **not** add it to `.env.production`. Next.js uses it to decide which env files to load; putting it inside the file it is trying to load creates a circular dependency.

> [!NOTE]
> `BETTER_AUTH_TRUSTED_ORIGINS` is **not needed in production** - all browser traffic arrives via the Cloudflare Tunnel, which always uses `https://dashboard.trickfirerobotics.com`. It is only required when accessing the dev server from a second machine on the LAN (e.g. testing on a phone at `http://192.168.1.50:3000`).

> [!CAUTION]
> Keep `.env.production` off `git`. The `BETTER_AUTH_SECRET` value lets anyone forge session tokens. If it's ever leaked, rotate it immediately and invalidate all sessions by changing the value.

> [!CAUTION]
> `VAULT_ENCRYPTION_KEY` is **required in production** - the app refuses to encrypt/decrypt vault secrets without it. Generate it separately from `BETTER_AUTH_SECRET` and back it up: rotating or losing it makes every existing API Key Vault entry permanently unrecoverable.

## 4. Database: Migrate and Seed

```bash
mkdir -p /home/trickfire/db

# Apply schema migrations
pnpm exec drizzle-kit migrate

# Seed the database
pnpm db:seed
```

> [!NOTE]
> The seed is idempotent - safe to run again without creating duplicates. Teams use `ON CONFLICT DO NOTHING`; the admin account is only created if the email doesn't already exist, then forced to `role = admin, isActive = true`.

## 5. Build

```bash
pnpm build
```

`output: "standalone"` produces a self-contained server at `.next/standalone/`. Next.js does **not** copy static assets into it automatically, so copy them after each build:

```bash
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
```

> [!WARNING]
> If you skip the `cp` steps, the app will start but all static assets (JS, CSS, images) will return 404. This is a common source of "login works but the page looks broken" issues.

The entrypoint is `.next/standalone/server.js`.

> [!NOTE]
> `better-sqlite3` is declared as `serverExternalPackages` in `next.config.ts`, so it loads from `node_modules` at runtime instead of being bundled. Keep `node_modules` present alongside the standalone output - the clone directory already has it.

## 6. Run as a systemd Service

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
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> [!IMPORTANT]
> Bind to `127.0.0.1`, not `0.0.0.0`. The Cloudflare Tunnel is the only thing that should reach this port. Binding to all interfaces would expose the app directly to the local network without TLS.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now trickfire-dashboard
sudo systemctl status trickfire-dashboard
journalctl -u trickfire-dashboard -f
```

## 7. Automated Deploys (GitHub Actions)

Every merge to `main` automatically runs `deploy.sh` on the server via a self-hosted GitHub Actions runner. This replaces the manual steps in [Updating an Existing Deployment](#updating-an-existing-deployment) for day-to-day releases.

### Install the runner

The runner must run as the `trickfire` user so it has access to the deployment directory.

```bash
# Switch to the trickfire user
sudo -u trickfire -s

# Create a directory for the runner
mkdir -p /home/trickfire/actions-runner
cd /home/trickfire/actions-runner
```

Go to your GitHub repo → **Settings → Actions → Runners → New self-hosted runner**, select **Linux / AMD64**, and follow the download and configure commands shown there. They look like:

```bash
# Download (use the exact URL and token from GitHub - they are one-time)
curl -o actions-runner-linux-x64.tar.gz -L <url-from-github>
tar xzf actions-runner-linux-x64.tar.gz

# Configure (use the token and URL from GitHub)
./config.sh --url https://github.com/<org>/<repo> --token <token>
```

When prompted for labels, add `self-hosted` (the default). When prompted for the runner group, accept the default.

Install and start it as a systemd service:

```bash
# Still as the trickfire user
sudo ./svc.sh install trickfire
sudo ./svc.sh start
sudo systemctl status actions.runner.*
```

### Allow the runner to restart the service

The deploy script calls `sudo systemctl restart trickfire-dashboard`. The dashboard also needs to start and stop the Minecraft service. Grant the `trickfire` user passwordless sudo for all three commands:

```bash
sudo visudo -f /etc/sudoers.d/trickfire-runner
```

Add these lines:

```
trickfire ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart trickfire-dashboard
trickfire ALL=(ALL) NOPASSWD: /usr/bin/systemctl start minecraft
trickfire ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop minecraft
```

### Verify

Push any commit to `main` (or merge a PR) and watch the Actions tab on GitHub. The **Deploy** workflow should appear, run on the server, and complete in roughly the same time as a manual deploy. Check the service afterwards:

```bash
sudo systemctl status trickfire-dashboard
journalctl -u trickfire-dashboard -f
```

> [!NOTE]
> Deploys are serialised - if two merges land in quick succession, the second waits for the first to finish rather than running concurrently.

## 8. Cloudflare Tunnel

Install `cloudflared` and authenticate (one-time, opens a browser):

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

Route DNS and install the tunnel as a service:

```bash
cloudflared tunnel route dns trickfire-dashboard dashboard.trickfirerobotics.com
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

> [!NOTE]
> The service API endpoint (`POST /api/service/verify`, used by simulation Python scripts) is reachable through the same tunnel and is IP-rate-limited via `x-forwarded-for` / `cf-connecting-ip` headers injected by Cloudflare.

## 9. Uptime Monitoring

Uptime is monitored by a Cloudflare Worker (`health/`) that pings `/api/health` every 5 minutes and posts a Discord alert if the dashboard is unreachable. The Worker runs on Cloudflare's edge and is unaffected by server outages.

### Deploy

```bash
cd health
pnpm dlx wrangler deploy
pnpm dlx wrangler secret put DISCORD_WEBHOOK_URL   # paste the Discord webhook URL when prompted
```

### How it works

- **Cron trigger** — runs every 5 minutes automatically.
- **HTTP handler** — visiting the Worker URL triggers an instant check, useful for testing.
- On failure, posts a Discord embed with the reason and timestamp, and pings the on-call members.

### Updating the ping list

The list of Discord user IDs to ping is hardcoded in `health/src/index.js` (`PING_IDS`). Edit the array and redeploy.

---

## 10. Tailscale Setup

Tailscale backs the Network tab in the dashboard. The club uses a shared Tailscale account so all devices belong to one tailnet.

### Install Tailscale on the server

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the login URL printed by `tailscale up` to authenticate with the club Tailscale account.

### Connect Other Devices

On any device you want on the network:

```bash
sudo tailscale up
```

Log in with the club Tailscale account. The device will appear in the Tailscale admin console and in the dashboard Network tab.

### Generate an API Key for the Dashboard

1. Go to the Tailscale admin console → **Settings → Keys → Generate access token**
2. Give it a description (e.g. `dashboard`) and set an expiry
3. Copy the key and add it to `.env.production`:

```env
TAILSCALE_API_KEY=<paste here>
TAILSCALE_TAILNET=-
```

> [!NOTE]
> `TAILSCALE_TAILNET=-` is a special value meaning "the tailnet that owns this API key". You can also use your tailnet name (e.g. `trickfirerobotics.com`) explicitly.

> [!CAUTION]
> The key is shown once. Store it securely. If it leaks, rotate it immediately in the Tailscale admin console and update `.env.production`.

Then restart the dashboard to pick up the new values:

```bash
sudo systemctl restart trickfire-dashboard
```

### Quick Reference

| Task            | Command / Location                              |
| --------------- | ----------------------------------------------- |
| Check status    | `tailscale status`                              |
| Get device IP   | `tailscale ip`                                  |
| List devices    | Tailscale admin console → Machines              |
| Remove a device | Tailscale admin console → Machines → … → Remove |
| Rotate API key  | Tailscale admin console → Settings → Keys       |
| View logs       | `journalctl -u tailscaled -f`                   |

## 11. Minecraft Server Setup

The Minecraft server runs as an independent systemd service (`minecraft.service`) managed by [Azalea](https://github.com/matejstastny/azalea). The dashboard can start and stop it, stream its logs, and send console commands via RCON - all without the server depending on the dashboard process.

### Install Azalea

Azalea requires Python 3.9+. Ubuntu 20.04 ships Python 3.8, so install 3.9 first:

```bash
sudo apt-get install -y python3.9 python3.9-venv
python3.9 -m pip install --user git+https://github.com/matejstastny/azalea.git
sudo ln -sf /home/trickfire/.local/bin/azalea /usr/local/bin/azalea
azalea --version  # verify
```

### Create the systemd service

Create `/etc/systemd/system/minecraft.service`:

```ini
[Unit]
Description=Minecraft Server
After=network.target

[Service]
Type=simple
User=trickfire
WorkingDirectory=/home/trickfire/minecraft
ExecStart=/usr/local/bin/azalea server run
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable it (but don't start it yet - the dashboard controls that):

```bash
sudo systemctl daemon-reload
sudo systemctl enable minecraft
```

### Configure RCON

The dashboard sends console commands to the server via RCON. Enable it in `/home/trickfire/minecraft/server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=<generate with: openssl rand -hex 16>
```

Then add the matching values to `/home/trickfire/dashboard/.env.production`:

```env
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=<same password as above>
```

Restart the dashboard to pick up the new vars:

```bash
sudo systemctl restart trickfire-dashboard
```

> [!NOTE]
> The Minecraft server must be restarted after changing `server.properties` for RCON changes to take effect.

### Environment variables summary

Add these to `.env.production` for the full Minecraft integration:

```env
MINECRAFT_SERVER_HOST=localhost
MINECRAFT_SERVER_PORT=25565
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=<password>
MINECRAFT_SERVER_PATH=/home/trickfire/minecraft
MINECRAFT_WORLD_PATH=/home/trickfire/minecraft/world
MINECRAFT_BOT_NAMES=BotA,BotB   # append :SkinURL for a custom skin
```

---

## 12. BlueMap Setup

The Minecraft page embeds the BlueMap web map. The dashboard proxies it at `/bluemap` so it is accessible via the dashboard URL without exposing BlueMap's port publicly.

### Install BlueMap

BlueMap is a Minecraft server-side mod/plugin. Follow the [official BlueMap docs](https://bluemap.bluecolored.de/) for your server type (Fabric, Paper, etc.). The web interface starts on port `8100` by default.

### Configure the Dashboard

Set `BLUEMAP_URL` in `.env.production` to the address the server can reach BlueMap on. If BlueMap runs on the same machine as the Minecraft server:

```env
BLUEMAP_URL=http://<minecraft-server-ip>:8100
```

If BlueMap is on the same machine as the dashboard:

```env
BLUEMAP_URL=http://localhost:8100
```

The dashboard proxies all requests from `/bluemap/...` to `BLUEMAP_URL`. BlueMap does **not** need to be exposed on the public firewall or in the Cloudflare Tunnel config.

### Firewall Note

Ensure port `8100` is **not** open to the internet. The dashboard acts as the only entry point. If BlueMap is on a separate server on the LAN, the server needs LAN access to port `8100` on that machine.

---

## Updating an Existing Deployment

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

> [!TIP]
> Check `journalctl -u trickfire-dashboard -f` immediately after restarting to catch any startup errors before declaring the deploy successful.

## Backups

The entire application state is the SQLite file at `/home/trickfire/db/dashboard.db`. A backup script and nightly cron job are already installed on the server.

**Script:** `/home/trickfire/scripts/backup-db.sh`
**Schedule:** every day at 02:00 (server local time)
**Retention:** 14 days - older files are removed automatically
**Log:** `/home/trickfire/backups/backup.log`

To run a backup manually at any time:

```bash
~/scripts/backup-db.sh
```

To verify the cron entry:

```bash
crontab -l
```

### Restore from backup

The backup file is a standalone SQLite database - no special tooling needed:

```bash
sudo systemctl stop trickfire-dashboard
cp /home/trickfire/backups/dashboard-<date>.db /home/trickfire/db/dashboard.db
sudo systemctl start trickfire-dashboard
```

## Database Safety

`pnpm db:reset` **cannot run in production**. It is blocked by a `predb:reset` lifecycle hook in `package.json` that checks `NODE_ENV` and exits with an error before the reset can execute. The database directory (`/home/trickfire/db/`) is outside the application directory so a `rm -rf ~/dashboard` would not touch it either.

## Troubleshooting

<details>
<summary><strong>Could not locate the bindings file / invalid ELF header</strong></summary>

`better-sqlite3` was compiled on a different machine or architecture. Recompile it on the server:

```bash
cd /home/trickfire/dashboard
pnpm rebuild better-sqlite3
```

If that doesn't work, do a clean reinstall:

```bash
rm -rf node_modules
pnpm install --frozen-lockfile
```

</details>

<details>
<summary><strong>Login works but assets (JS/CSS/images) return 404</strong></summary>

The post-build copy step was skipped. Run:

```bash
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
sudo systemctl restart trickfire-dashboard
```

</details>

<details>
<summary><strong>Minecraft card shows "offline"</strong></summary>

Verify that `MINECRAFT_SERVER_HOST` and `MINECRAFT_SERVER_PORT` are set correctly in `.env.production`, and that the server can reach the Minecraft server on the LAN. The status check fails gracefully to "offline" by design - it's not a crash, just an unreachable host.

</details>

<details>
<summary><strong>BlueMap map shows "map unavailable"</strong></summary>

1. Confirm BlueMap is running on the Minecraft server and its web interface is up: `curl http://<bluemap-host>:8100` should return HTML.
2. Check that `BLUEMAP_URL` in `.env.production` points to the correct host and port, and that the server can reach it on the LAN.
3. Restart the dashboard after any `.env.production` change: `sudo systemctl restart trickfire-dashboard`.
4. If BlueMap is running but the map tiles are empty, BlueMap may still be rendering - check its logs on the Minecraft server.

</details>

<details>
<summary><strong>Login freezes or returns 403 "Invalid origin" when accessed from a second machine on the LAN</strong></summary>

In production this shouldn't happen (all traffic goes through the Cloudflare Tunnel). If you're testing the production build locally from another device, set `BETTER_AUTH_TRUSTED_ORIGINS` to the LAN address of the server:

```env
BETTER_AUTH_TRUSTED_ORIGINS=http://192.168.1.50:3000
```

Restart the service to pick up the change. You can specify multiple origins as a comma-separated list.

</details>

<details>
<summary><strong>Network tab shows an error / Tailscale unreachable</strong></summary>

1. Confirm `TAILSCALE_API_KEY` is set in `.env.production` and is not expired.
2. Rotate if needed: Tailscale admin console → Settings → Keys → Generate access token.
3. After updating the key, restart the service: `sudo systemctl restart trickfire-dashboard`

</details>

<details>
<summary><strong>Service fails to start - checking logs</strong></summary>

```bash
journalctl -u trickfire-dashboard -n 100 --no-pager
```

Common causes: missing `.env.production`, wrong `DATABASE_PATH` (directory doesn't exist), or a failed migration.

</details>
