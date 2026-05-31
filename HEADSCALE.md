# Setting up Headscale

## 1. Install Headscale on the Xavier

Headscale ships a single binary. Grab the ARM64 release:

```bash
# Find the latest version at https://github.com/juanfont/headscale/releases
HEADSCALE_VERSION="0.25.1"

wget -O headscale.deb \
  "https://github.com/juanfont/headscale/releases/download/v${HEADSCALE_VERSION}/headscale_${HEADSCALE_VERSION}_linux_arm64.deb"

sudo dpkg -i headscale.deb
rm headscale.deb
```

Verify:

```bash
headscale version
```

## 2. Configure Headscale

The config file lives at `/etc/headscale/config.yaml`. Open it:

```bash
sudo nano /etc/headscale/config.yaml
```

Key settings to update:

```yaml
# The public hostname others will connect to
server_url: https://headscale.trickfirerobotics.com:443

# Listen address for the gRPC/REST API (dashboard talks to this)
listen_addr: 0.0.0.0:50443
metrics_listen_addr: 0.0.0.0:9090

# Database
database:
    type: sqlite
    sqlite:
        path: /var/lib/headscale/db.sqlite

# DNS - give devices names like "laptop.trickfire"
dns:
    magic_dns: true
    base_domain: trickfire

# IP address ranges assigned to devices
ip_prefixes:
    - fd7a:115c:a1e0::/48 # IPv6
    - 100.64.0.0/10 # IPv4 (Tailscale CGNAT range)
```

> If you are keeping everything on localhost (dashboard + Headscale on the same machine) and not exposing Headscale publicly, set `server_url: http://localhost:50443` and `listen_addr: 127.0.0.1:50443` instead.

## 3. Enable and start the service

Headscale installs a systemd unit automatically:

```bash
sudo systemctl enable headscale
sudo systemctl start headscale
sudo systemctl status headscale
```

Check the logs if something looks wrong:

```bash
sudo journalctl -u headscale -f
```

## 4. Create a user/namespace

Headscale organises devices into users (called namespaces in older versions). Create one for the club:

```bash
headscale users create trickfire
```

List users:

```bash
headscale users list
```

## 5. Generate an API key for the dashboard

The dashboard talks to Headscale's REST API and needs an API key:

```bash
# Create a key that expires in 1 year (adjust as needed)
headscale apikeys create --expiration 8760h
```

This prints the key once - copy it now. Then add it to the dashboard's environment file on the Xavier:

```bash
sudo nano /opt/trickfire-dashboard/.env.local
```

Add or update these two lines:

```env
HEADSCALE_URL=http://localhost:50443
HEADSCALE_API_KEY=<paste key here>
```

Then redeploy the dashboard so it picks up the new variables:

```bash
cd /opt/trickfire-dashboard
pnpm deploy
```

The Network tab in the dashboard will go green once Headscale is reachable.

---

## 6. Connect a device (using Tailscale client)

Devices use the regular Tailscale client but point at your Headscale server instead of Tailscale's servers.

### macOS / Linux

```bash
# Install Tailscale (if not already installed)
# macOS: brew install tailscale
# Ubuntu/Debian: curl -fsSL https://tailscale.com/install.sh | sh

sudo tailscale up --login-server https://headscale.trickfirerobotics.com
```

This prints a registration URL. Copy it.

### Windows

Install Tailscale from the Microsoft Store or tailscale.com, then from an admin PowerShell:

```powershell
tailscale up --login-server https://headscale.trickfirerobotics.com
```

---

## 7. Approve the device on the server

After a device runs `tailscale up`, it shows up as a pending registration on the Headscale server. Approve it:

```bash
# List pending registrations
headscale nodes list

# Approve the node (replace <node-id> with the id from the list)
headscale nodes register --user trickfire --key <mkey:...>
```

> The machine key (`mkey:...`) is printed by `tailscale up` on the client, or visible in `headscale nodes list`.

Once approved, the device gets an IP and can reach other devices on the network.

---

## 8. Verify the connection

On the connected device:

```bash
# Should show the Headscale-assigned IP (100.x.x.x or fd7a::...)
tailscale ip

# Ping another device by its MagicDNS name
ping xavier.trickfire
```

On the server:

```bash
headscale nodes list
```

---

## Useful commands

| Task              | Command                                      |
| ----------------- | -------------------------------------------- |
| List all nodes    | `headscale nodes list`                       |
| Delete a node     | `headscale nodes delete --identifier <id>`   |
| Expire a node key | `headscale nodes expire --identifier <id>`   |
| List routes       | `headscale routes list`                      |
| Enable a route    | `headscale routes enable --route <id>`       |
| List API keys     | `headscale apikeys list`                     |
| Expire an API key | `headscale apikeys expire --prefix <prefix>` |
| View logs         | `sudo journalctl -u headscale -f`            |
| Reload config     | `sudo systemctl restart headscale`           |

---

## Cloudflare Tunnel (optional)

If you want devices outside the lab to be able to connect, Headscale needs to be publicly reachable. You can route it through Cloudflare Tunnel similarly to how the dashboard is exposed - add a second ingress rule in your `config.yml` pointing at `localhost:50443` under a separate hostname like `headscale.trickfirerobotics.com`.

Members connecting from home would then use:

```bash
tailscale up --login-server https://headscale.trickfirerobotics.com
```
