# Integrations

Optional services that extend dashboard functionality. Configure only what you need - the app degrades gracefully when any of these are absent.

## Tailscale (Network Tab)

The Network tab shows all devices on the club's shared Tailscale network and surfaces join requests from members.

### Install Tailscale on the server

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the login URL printed by `tailscale up` to authenticate with the club Tailscale account.

### Generate an API key for the dashboard

1. Tailscale admin console → **Settings → Keys → Generate access token**
2. Give it a description (e.g. `dashboard`) and set an expiry
3. Add to `.env.production`:

```env
TAILSCALE_API_KEY=<paste here>
TAILSCALE_TAILNET=-
```

Restart the dashboard to pick up the new values:

```bash
sudo systemctl restart trickfire-dashboard
```

> [!NOTE]
> `TAILSCALE_TAILNET=-` is a special value meaning "the tailnet that owns this API key". You can also use your tailnet name explicitly (e.g. `trickfirerobotics.com`).

> [!CAUTION]
> The key is shown once. If it leaks, rotate it immediately in the Tailscale admin console and update `.env.production`.

### Connect other devices

On any device you want on the network:

```bash
sudo tailscale up
```

Log in with the club Tailscale account. The device will appear in the Tailscale admin console and in the dashboard Network tab.

### Quick reference

| Task            | Command / Location                              |
| --------------- | ----------------------------------------------- |
| Check status    | `tailscale status`                              |
| Get device IP   | `tailscale ip`                                  |
| List devices    | Tailscale admin console → Machines              |
| Remove a device | Tailscale admin console → Machines → … → Remove |
| Rotate API key  | Tailscale admin console → Settings → Keys       |
| View logs       | `journalctl -u tailscaled -f`                   |

---

## Minecraft Server

The Minecraft server runs as an independent systemd service managed by [Azalea](https://github.com/matejstastny/azalea). The dashboard can start and stop it, stream its logs, and send console commands via RCON - without the server depending on the dashboard process.

### Install Azalea

Azalea requires Python 3.9+. Ubuntu 20.04 ships Python 3.8, so install 3.9 first if needed:

```bash
sudo apt-get install -y python3.9 python3.9-venv
python3.9 -m pip install --user git+https://github.com/matejstastny/azalea.git
sudo ln -sf /home/trickfire/.local/bin/azalea /usr/local/bin/azalea
azalea --version
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

```bash
sudo systemctl daemon-reload
sudo systemctl enable minecraft   # enable but don't start - the dashboard controls that
```

### Configure RCON

The dashboard sends console commands to the server via RCON. Enable it in `/home/trickfire/minecraft/server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=<openssl rand -hex 16>
```

> [!NOTE]
> The Minecraft server must be restarted after changing `server.properties` for RCON to take effect.

### Environment variables

Add these to `.env.production`:

```env
MINECRAFT_SERVER_HOST=localhost
MINECRAFT_SERVER_PORT=25565
MINECRAFT_SERVER_PATH=/home/trickfire/minecraft
MINECRAFT_WORLD_PATH=/home/trickfire/minecraft/world
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=<same password as server.properties>
MINECRAFT_BOT_NAMES=BotA,BotB   # append :SkinURL for a custom skin
```

Restart the dashboard to pick up the new values:

```bash
sudo systemctl restart trickfire-dashboard
```

### Troubleshooting

<details>
<summary><strong>Minecraft card shows "offline"</strong></summary>

Verify `MINECRAFT_SERVER_HOST` and `MINECRAFT_SERVER_PORT` are correct in `.env.production` and that the dashboard server can reach the Minecraft server on the LAN. The status check fails gracefully to "offline" - it's not a crash.

</details>

---

## Pl3xMap (World Map)

The Minecraft page embeds the Pl3xMap world map. The dashboard proxies it at `/pl3xmap` so it's accessible via the dashboard URL without exposing Pl3xMap's port publicly.

### Install Pl3xMap

Pl3xMap is a server-side Minecraft mod. Follow the [official Pl3xMap docs](https://modrinth.com/plugin/pl3xmap) for your server type (Fabric, Paper, etc.). Its internal web server runs on port `8080` by default.

### Configure the dashboard

Add to `.env.production`:

```env
# If Pl3xMap runs on the same machine as the dashboard:
PL3XMAP_URL=http://localhost:8080

# If Pl3xMap runs on a separate machine:
PL3XMAP_URL=http://<minecraft-server-ip>:8080
```

Restart: `sudo systemctl restart trickfire-dashboard`

> [!NOTE]
> Port `8080` must **not** be open to the internet. The dashboard is the only entry point. If Pl3xMap is on a separate server, the dashboard host needs LAN access to port `8080` on that machine.

### Troubleshooting

<details>
<summary><strong>Pl3xMap shows "map unavailable"</strong></summary>

1. Confirm Pl3xMap is running: `curl http://<pl3xmap-host>:8080` should return HTML.
2. Check `PL3XMAP_URL` in `.env.production` points to the correct host and port, and the dashboard server can reach it on the LAN.
3. Restart after any env change: `sudo systemctl restart trickfire-dashboard`
4. If the map loads but tiles are empty, Pl3xMap may still be rendering the world - check its logs on the Minecraft server.

</details>
