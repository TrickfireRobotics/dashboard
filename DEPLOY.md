# Deploying the TrickFire Dashboard

Production runs on the lab's **Jetson Xavier (ARM64)** at `https://dashboard.trickfirerobotics.com`, exposed through a Cloudflare Tunnel. It is a Next.js 15 app using `output: "standalone"` with a local SQLite database (`better-sqlite3`).

All steps below are run **on the Xavier** unless noted otherwise. The `better-sqlite3` native binary must be compiled on the device.

> [!IMPORTANT]
> The Xavier is ARM64. Any native dependency compiled on a dev machine (x86/ARM Mac) won't work here - always install and build directly on the device.

## Table of Contents

1. [Initial Setup](#1-initial-setup)
2. [Get the Code](#2-get-the-code)
3. [Configure Environment](#3-configure-environment)
4. [Database: Migrate and Seed](#4-database-migrate-and-seed)
5. [Build](#5-build)
6. [Run as a systemd Service](#6-run-as-a-systemd-service)
7. [Cloudflare Tunnel](#7-cloudflare-tunnel)
8. [Headscale Setup](#8-headscale-setup)
9. [BlueMap Setup](#9-bluemap-setup)
10. [Updating an Existing Deployment](#updating-an-existing-deployment)
11. [Backups](#backups)
12. [Troubleshooting](#troubleshooting)

---

## 1. Initial Setup

```bash
# Confirm Node.js is installed, match the major version the app targets where possible
node --version

# Enable pnpm via corepack
corepack enable pnpm
pnpm --version

# Build toolchain for compiling better-sqlite3's native addon on ARM64
sudo apt-get update
sudo apt-get install -y build-essential python3
```

## 2. Get the Code

```bash
sudo mkdir -p /opt/trickfire-dashboard
sudo chown "$USER" /opt/trickfire-dashboard

git clone <repo-url> /opt/trickfire-dashboard
cd /opt/trickfire-dashboard/dashboard

# Installs deps and compiles better-sqlite3 against the Xavier's Node + ARM64
pnpm install --frozen-lockfile
```

## 3. Configure Environment

1. Create `/opt/trickfire-dashboard/dashboard/.env.local` - use `.env.example` as the template.
2. See [Environment Variables in README.md](README.md#environment-variables) for descriptions of every key.
3. Generate the auth secret:

    ```bash
    openssl rand -hex 32
    ```

### Key values for production

```env
NEXT_PUBLIC_APP_URL=https://dashboard.trickfirerobotics.com
BETTER_AUTH_URL=https://dashboard.trickfirerobotics.com
BETTER_AUTH_SECRET=<generated above>

DATABASE_PATH=/opt/trickfire-dashboard/db/dashboard.db

# Minecraft
MINECRAFT_SERVER_HOST=<host or LAN IP of the Minecraft server>
MINECRAFT_SERVER_PORT=25565
MINECRAFT_WORLD_PATH=/opt/minecraft/world
MINECRAFT_BOT_NAMES=BotA,BotB         # comma-separated; append :SkinURL for a custom skin
BLUEMAP_URL=http://localhost:8100

# Headscale
HEADSCALE_URL=http://localhost:50443
HEADSCALE_API_KEY=<from headscale apikeys create>

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=TrickFire Robotics <noreply@trickfirerobotics.com>
```

> [!NOTE]
> `BETTER_AUTH_TRUSTED_ORIGINS` is **not needed in production** - all browser traffic arrives via the Cloudflare Tunnel, which always uses `https://dashboard.trickfirerobotics.com`. It is only required when accessing the dev server from a second machine on the LAN (e.g. testing on a phone at `http://192.168.1.50:3000`).

> [!CAUTION]
> Keep `.env.local` off `git`. The `BETTER_AUTH_SECRET` value lets anyone forge session tokens. If it's ever leaked, rotate it immediately and invalidate all sessions by changing the value.

## 4. Database: Migrate and Seed

```bash
mkdir -p /opt/trickfire-dashboard/db

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
WorkingDirectory=/opt/trickfire-dashboard/dashboard
EnvironmentFile=/opt/trickfire-dashboard/dashboard/.env.local
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node /opt/trickfire-dashboard/dashboard/.next/standalone/server.js
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

## 7. Cloudflare Tunnel

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

## 8. Headscale Setup

Headscale is the self-hosted Tailscale control server that backs the Network tab in the dashboard. It runs alongside the dashboard on the Xavier.

### Install Headscale

Headscale ships as a single binary. Get the ARM64 `.deb` release:

```bash
# Check https://github.com/juanfont/headscale/releases for the latest version
HEADSCALE_VERSION="0.25.1"

wget -O headscale.deb \
  "https://github.com/juanfont/headscale/releases/download/v${HEADSCALE_VERSION}/headscale_${HEADSCALE_VERSION}_linux_arm64.deb"

sudo dpkg -i headscale.deb
rm headscale.deb

headscale version   # verify
```

### Configure Headscale

Edit `/etc/headscale/config.yaml`:

```yaml
# Public URL that devices will connect to
server_url: https://headscale.trickfirerobotics.com:443

# REST API + gRPC listen address (the dashboard talks to this)
listen_addr: 0.0.0.0:50443
metrics_listen_addr: 0.0.0.0:9090

database:
    type: sqlite
    sqlite:
        path: /var/lib/headscale/db.sqlite

dns:
    magic_dns: true
    base_domain: trickfire # devices get names like laptop.trickfire

ip_prefixes:
    - fd7a:115c:a1e0::/48 # IPv6
    - 100.64.0.0/10 # IPv4 (Tailscale CGNAT range)
```

> [!TIP]
> If Headscale stays on the same machine as the dashboard and doesn't need to be publicly accessible, use `server_url: http://localhost:50443` and `listen_addr: 127.0.0.1:50443` instead. This keeps the control server off the internet entirely.

### Start the Service

Headscale installs a systemd unit automatically:

```bash
sudo systemctl enable headscale
sudo systemctl start headscale
sudo systemctl status headscale
journalctl -u headscale -f          # tail logs
```

### Create a User

Headscale organises devices into users (called namespaces in older versions). Create one for the club:

```bash
headscale users create trickfire
headscale users list
```

### Generate an API Key for the Dashboard

```bash
# Creates a key expiring in 1 year
headscale apikeys create --expiration 8760h
```

> [!CAUTION]
> The key is printed exactly once. Copy it immediately and add it to `.env.local`:
>
> ```env
> HEADSCALE_URL=http://localhost:50443
> HEADSCALE_API_KEY=<paste here>
> ```
>
> Then restart the dashboard service so it picks up the new value.

### Connect a Device

Devices use the standard Tailscale client pointed at your Headscale server.

```bash
sudo tailscale up --login-server https://headscale.trickfirerobotics.com
```

This prints a registration URL - copy it.

### Approve the Device on the Server

After a device runs `tailscale up`, it appears as a pending registration:

```bash
headscale nodes list

# Approve the node - machine key is printed by tailscale up on the client
headscale nodes register --user trickfire --key <mkey:...>
```

Once approved, the device gets an IP and can reach other nodes on the network.

### Verify the Connection

On the connected device:

```bash
tailscale ip                    # shows the Headscale-assigned IP (100.x.x.x or fd7a::...)
ping xavier.trickfire           # MagicDNS
```

On the server:

```bash
headscale nodes list
```

### Headscale Quick Reference

| Task              | Command                                      |
| ----------------- | -------------------------------------------- |
| List all nodes    | `headscale nodes list`                       |
| Delete a node     | `headscale nodes delete --identifier <id>`   |
| Expire a node key | `headscale nodes expire --identifier <id>`   |
| List routes       | `headscale routes list`                      |
| Enable a route    | `headscale routes enable --route <id>`       |
| List API keys     | `headscale apikeys list`                     |
| Expire an API key | `headscale apikeys expire --prefix <prefix>` |
| View logs         | `journalctl -u headscale -f`                 |
| Reload config     | `systemctl restart headscale`                |

### Expose Headscale Publicly

To make the headscale network work outside of the lab, add a second ingress rule in `~/.cloudflared/config.yml`:

```yaml
ingress:
    - hostname: dashboard.trickfirerobotics.com
      service: http://127.0.0.1:3000
    - hostname: headscale.trickfirerobotics.com
      service: http://127.0.0.1:50443
    - service: http_status:404
```

Members connecting from home then use:

```bash
tailscale up --login-server https://headscale.trickfirerobotics.com
```

## 9. BlueMap Setup

The Minecraft page embeds the BlueMap web map. The dashboard proxies it at `/bluemap` so it is accessible via the dashboard URL without exposing BlueMap's port publicly.

### Install BlueMap

BlueMap is a Minecraft server-side mod/plugin. Follow the [official BlueMap docs](https://bluemap.bluecolored.de/) for your server type (Fabric, Paper, etc.). The web interface starts on port `8100` by default.

### Configure the Dashboard

Set `BLUEMAP_URL` in `.env.local` to the address the Xavier can reach BlueMap on. If BlueMap runs on the same machine as the Minecraft server:

```env
BLUEMAP_URL=http://<minecraft-server-ip>:8100
```

If BlueMap is on the same machine as the dashboard:

```env
BLUEMAP_URL=http://localhost:8100
```

The dashboard proxies all requests from `/bluemap/...` to `BLUEMAP_URL`. BlueMap does **not** need to be exposed on the public firewall or in the Cloudflare Tunnel config.

### Firewall Note

Ensure port `8100` is **not** open to the internet. The dashboard acts as the only entry point. If BlueMap is on a separate server on the LAN, the Xavier needs LAN access to port `8100` on that machine.

---

## Updating an Existing Deployment

```bash
cd /opt/trickfire-dashboard
git pull

cd dashboard
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

The entire application state is the SQLite file. Back it up with the WAL checkpointed to avoid backing up a partial transaction:

```bash
sqlite3 /opt/trickfire-dashboard/db/dashboard.db \
  ".backup '/opt/trickfire-dashboard/backups/dashboard-$(date +%F).db'"
```

Automate with a cron job or systemd timer. The backup file is a standalone SQLite database - no restore tooling needed, just copy it back and restart the service.

## Troubleshooting

<details>
<summary><strong>Could not locate the bindings file / invalid ELF header</strong></summary>

`better-sqlite3` was compiled on a different machine or architecture. Recompile it on the Xavier:

```bash
cd /opt/trickfire-dashboard/dashboard
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

Verify that `MINECRAFT_SERVER_HOST` and `MINECRAFT_SERVER_PORT` are set correctly in `.env.local`, and that the Xavier can reach the Minecraft server on the LAN. The status check fails gracefully to "offline" by design - it's not a crash, just an unreachable host.

</details>

<details>
<summary><strong>BlueMap map shows "map unavailable"</strong></summary>

1. Confirm BlueMap is running on the Minecraft server and its web interface is up: `curl http://<bluemap-host>:8100` should return HTML.
2. Check that `BLUEMAP_URL` in `.env.local` points to the correct host and port, and that the Xavier can reach it on the LAN.
3. Restart the dashboard after any `.env.local` change: `sudo systemctl restart trickfire-dashboard`.
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
<summary><strong>Network tab shows an error / Headscale unreachable</strong></summary>

1. Confirm Headscale is running: `systemctl status headscale`
2. Check `HEADSCALE_URL` in `.env.local` - it must match the `listen_addr` in Headscale's config.
3. Check the API key hasn't expired: `headscale apikeys list`
4. Look at Headscale logs: `journalctl -u headscale -f`

</details>

<details>
<summary><strong>Service fails to start - checking logs</strong></summary>

```bash
journalctl -u trickfire-dashboard -n 100 --no-pager
```

Common causes: missing `.env.local`, wrong `DATABASE_PATH` (directory doesn't exist), or a failed migration.

</details>
