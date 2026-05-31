# Deploying the TrickFire Dashboard

This portal currently runs on the lab's Jetson Xavier (ARM64) and is exposed at
`https://dashboard.trickfirerobotics.com` through a Cloudflare Tunnel. It is a
Next.js 15 app using `output: "standalone"` and a local SQLite database
(`better-sqlite3`).

These steps are run **on the Xavier**. The native `better-sqlite3` binary must
be compiled on the device.

## 1. Setup

```bash
# Node.js (match the major version the app was built against where possible).
node --version

# Enable pnpm via corepack (no global install needed).
corepack enable pnpm
pnpm --version

# Build toolchain for compiling better-sqlite3's native addon on ARM64.
sudo apt-get update
sudo apt-get install -y build-essential python3
```

## 2. Get the code and install

```bash
sudo mkdir -p /opt/trickfire-dashboard
sudo chown "$USER" /opt/trickfire-dashboard
git clone <repo-url> /opt/trickfire-dashboard
cd /opt/trickfire-dashboard/dashboard

# Installs deps and compiles better-sqlite3 against the Xavier's Node/ARM64.
pnpm install --frozen-lockfile
```

## 3. Configure environment

1. Create `/opt/trickfire-dashboard/dashboard/.env.local` (see `.env.example`). Each key is explained in the [README](README.md).
2. Generate the auth secret with `openssl rand -hex 32`. Keep this file off `git`.

## 4. Database: migrate + seed

```bash
mkdir -p /opt/trickfire-dashboard/db

# Apply schema migrations.
pnpm exec drizzle-kit migrate

# Seed the 6 teams and the admin user.
# IMPORTANT: run via tsx, NOT `node scripts/seed.ts`.
# Node's native --experimental-strip-types cannot run all TS constructs;
# tsx handles the full transform reliably.
pnpm exec tsx scripts/seed.ts
```

The seed is idempotent: teams use `onConflictDoNothing`, and the admin is only
created if the email doesn't already exist (then forced to `role=admin`,
`isActive=true`).

## 5. Build (standalone)

```bash
pnpm build
```

`output: "standalone"` produces a self-contained server under
`.next/standalone/`. Next does **not** copy static assets or `public/` into it,
so copy them in after each build:

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

The entrypoint is then `.next/standalone/server.js`.

> `better-sqlite3` stays external (`serverExternalPackages`), so it is loaded
> from `node_modules` at runtime rather than bundled. Keep `node_modules`
> present alongside the standalone output (the clone directory already has it).

## 6. Run as a systemd service

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

Bind to `127.0.0.1` - the Cloudflare Tunnel is the only thing that should reach
the port. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now trickfire-dashboard
sudo systemctl status trickfire-dashboard
journalctl -u trickfire-dashboard -f   # tail logs
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

Route DNS and run the tunnel as a service:

```bash
cloudflared tunnel route dns trickfire-dashboard dashboard.trickfirerobotics.com
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

The public API-key verification endpoint
(`POST /api/service/verify`, used by sim Python scripts) is reachable through
the same tunnel and is IP-rate-limited via `x-forwarded-for` /
`cf-connecting-ip`.

---

## Updating an existing deployment

```bash
cd /opt/trickfire-dashboard
git pull
cd dashboard
pnpm install --frozen-lockfile     # recompiles native deps if versions changed
pnpm exec drizzle-kit migrate      # apply any new migrations
pnpm build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
sudo systemctl restart trickfire-dashboard
```

## Backups

The entire state is the SQLite file. Back it up with the WAL checkpointed:

```bash
sqlite3 /opt/trickfire-dashboard/db/dashboard.db ".backup '/opt/trickfire-dashboard/backups/dashboard-$(date +%F).db'"
```

## Troubleshooting

- **`Could not locate the bindings file` / `invalid ELF header`** -
  `better-sqlite3` was not compiled on this device. Run
  `pnpm rebuild better-sqlite3` (or reinstall) on the Xavier.
- **Login works but assets 404** - the `cp -r .next/static …` /
  `cp -r public …` step was skipped after building.
- **Minecraft card shows "offline"** - verify `MINECRAFT_SERVER_HOST/PORT` and
  that the Xavier can reach the MC server on the LAN; the status call fails
  gracefully to offline by design.
