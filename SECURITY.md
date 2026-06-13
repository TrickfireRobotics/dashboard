# Server Security

Documents the security posture of the production server (`tfserver`) - what it looked like out of the box and what was hardened, plus a setup guide for doing it from scratch on a fresh Debian install.

## Table of Contents

1. [Before vs. After](#1-before-vs-after)
2. [SSH: Key-Only Authentication](#2-ssh-key-only-authentication)
3. [Firewall (ufw)](#3-firewall-ufw)
4. [Fail2ban](#4-fail2ban)
5. [Automatic Security Updates](#5-automatic-security-updates)
6. [Tailscale Access Control](#6-tailscale-access-control)
7. [Remaining Risks](#7-remaining-risks)

---

## 1. Before vs. After

| Area                   | Before                                                                           | After                                                      |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SSH auth               | One word password, shared by everyone                                            | Key-only - password auth disabled                          |
| SSH access             | Open on all interfaces (`0.0.0.0:22`), reachable from entire WiFi/campus network | Restricted to Tailscale interface only via ufw             |
| Firewall               | None - no ufw, no iptables rules                                                 | ufw active, deny all incoming by default                   |
| Brute force protection | None                                                                             | fail2ban: 5 attempts → 1 h ban                             |
| Root login             | Default (`prohibit-password`)                                                    | Explicitly disabled                                        |
| X11 forwarding         | Enabled                                                                          | Disabled                                                   |
| Security updates       | Manual only                                                                      | Unattended upgrades enabled                                |
| Disk encryption        | None                                                                             | None (planned - see [Remaining Risks](#7-remaining-risks)) |

---

## 2. SSH: Key-Only Authentication

### Setup (fresh server)

**On your local machine** - generate a key if you don't have one:

```bash
ssh-keygen -t ed25519 -C "your-name@machine"
```

**Copy your public key to the server** (do this before disabling password auth):

```bash
ssh-copy-id trickfire@<server-ip>
# or manually:
cat ~/.ssh/id_ed25519.pub | ssh trickfire@<server-ip> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

**Verify key login works before continuing:**

```bash
ssh -o PasswordAuthentication=no trickfire@<server-ip>
```

Only proceed once key login is confirmed.

**Create the hardened sshd drop-in:**

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardened.conf > /dev/null << 'EOF'
PasswordAuthentication no
PermitRootLogin no
X11Forwarding no
AllowUsers trickfire
EOF
```

**Validate and reload:**

```bash
sudo sshd -t           # must print nothing (no errors)
sudo systemctl reload ssh
```

**Confirm password auth is rejected:**

```bash
# From another terminal - should return "Permission denied (publickey)"
ssh -o PubkeyAuthentication=no trickfire@<server-ip>
```

### Adding another admin's key

```bash
# On the server, append their public key
echo "ssh-ed25519 AAAA... name@machine" >> ~/.ssh/authorized_keys
```

If they need their own account instead of sharing `trickfire`:

```bash
sudo adduser <username>
sudo mkdir -p /home/<username>/.ssh
sudo tee /home/<username>/.ssh/authorized_keys <<< "ssh-ed25519 AAAA... name@machine"
sudo chmod 700 /home/<username>/.ssh
sudo chmod 600 /home/<username>/.ssh/authorized_keys
sudo chown -R <username>:<username> /home/<username>/.ssh
```

---

## 3. Firewall (ufw)

The server uses Tailscale for all remote access. SSH is allowed only on the `tailscale0` interface - the WiFi interface (`wlp2s0`) gets a connection refused for port 22.

### Setup

```bash
sudo apt-get install -y ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH only from Tailscale
sudo ufw allow in on tailscale0 to any port 22 proto tcp comment 'SSH via Tailscale only'

# Allow all Tailscale traffic (dashboard internal comms, etc.)
sudo ufw allow in on tailscale0

sudo ufw enable
sudo ufw status verbose
```

> [!IMPORTANT]
> Enable ufw **after** confirming Tailscale is running and your SSH key works. If you lock yourself out, you will need physical console access to recover.

### Verify

From outside Tailscale (e.g. the lab WiFi directly):

```bash
ssh trickfire@<server-wifi-ip>   # should time out or refuse
```

From inside Tailscale:

```bash
ssh trickfire@<server-tailscale-ip>  # should connect (key required)
```

---

## 4. Fail2ban

Bans IPs after repeated failed SSH attempts. Mostly redundant now that SSH is key-only and Tailscale-restricted, but good defense-in-depth.

### Setup

```bash
sudo apt-get install -y fail2ban

sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF

sudo systemctl enable --now fail2ban
```

### Check status

```bash
sudo fail2ban-client status sshd
sudo fail2ban-client status
```

---

## 5. Automatic Security Updates

Security patches are applied automatically every night without manual intervention.

### Setup

```bash
sudo apt-get install -y unattended-upgrades

cat > /tmp/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
sudo cp /tmp/20auto-upgrades /etc/apt/apt.conf.d/20auto-upgrades
```

### Verify

```bash
sudo unattended-upgrades --dry-run
```

---

## 6. Tailscale Access Control

All machines on the tailnet can currently reach all other machines (default Tailscale ACL). SSH is protected by key auth regardless, but for stricter network-level control the ACL can be tightened in the Tailscale admin console under **Access Controls**.

Example ACL to restrict SSH to tfserver to one machine only:

```json
{
    "acls": [
        {
            "action": "accept",
            "src": ["<your-tailscale-ip>"],
            "dst": ["<server-tailscale-ip>:22"]
        }
    ]
}
```

Replace `<your-tailscale-ip>` with your machine's Tailscale IP (`tailscale ip -4`) and `<server-tailscale-ip>` with the server's (`tailscale status`).

> [!NOTE]
> This is a nice-to-have. The key-only SSH requirement already ensures that even if another tailnet member reaches port 22, they cannot authenticate without your private key.

---

## 7. Remaining Risks

### Full-disk encryption (LUKS) - not yet done

The NVMe drive has no encryption. Physical access to the machine gives access to:

- `.env.production` (auth secret, encryption key, API keys)
- Cloudflare tunnel credentials (`~/.cloudflared/*.json`)
- GitHub Actions runner token (`~/actions-runner/.env`)
- The SQLite database

This is especially relevant given that hardware theft has occurred in the lab.

**To fix:** reinstall Debian with LUKS full-disk encryption enabled in the installer. Configure a remote unlock mechanism (e.g. Dropbear SSH in initramfs) so the server can reboot unattended and still prompt for the LUKS passphrase over the network. Schedule this for the next available maintenance window.

**Interim mitigations in place:**

- Server is physically better secured than the stolen machine
- Cloudflare credentials are scoped to a single tunnel - revocable from the dashboard
- GitHub runner token can be revoked from the repo settings
- Auth secret and vault key rotation requires a redeploy but no data loss
