# Server Hardening

Documents what was hardened on the production server (`tfserver`) and how to reproduce it from scratch on a fresh Debian install.

## Before vs. After

| Area                   | Before                                                            | After                                                    |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| SSH auth               | One shared password                                               | Key-only - password auth disabled                        |
| SSH access             | Open on all interfaces, reachable from entire WiFi/campus network | Restricted to Tailscale interface only via ufw           |
| Firewall               | None                                                              | ufw active, deny all incoming by default                 |
| Brute force protection | None                                                              | fail2ban: 5 attempts → 1 h ban                           |
| Root login             | Default (`prohibit-password`)                                     | Explicitly disabled                                      |
| X11 forwarding         | Enabled                                                           | Disabled                                                 |
| Security updates       | Manual only                                                       | Unattended upgrades enabled                              |
| Disk encryption        | None                                                              | None (planned - see [Remaining Risks](#remaining-risks)) |

---

## SSH: Key-Only Authentication

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

**Create the hardened sshd config:**

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
# Should return "Permission denied (publickey)"
ssh -o PubkeyAuthentication=no trickfire@<server-ip>
```

### Adding another admin's key

```bash
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

## Firewall (ufw)

SSH is allowed only on the `tailscale0` interface. The WiFi interface (`wlp2s0`) will refuse connections on port 22.

```bash
sudo apt-get install -y ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH only from Tailscale
sudo ufw allow in on tailscale0 to any port 22 proto tcp comment 'SSH via Tailscale only'

# Allow all Tailscale traffic
sudo ufw allow in on tailscale0

sudo ufw enable
sudo ufw status verbose
```

> [!IMPORTANT]
> Enable ufw **after** confirming Tailscale is running and your SSH key works. If you lock yourself out, you will need physical console access to recover.

**Verify** from outside Tailscale (e.g. the lab WiFi directly):

```bash
ssh trickfire@<server-wifi-ip>   # should time out or refuse
```

From inside Tailscale:

```bash
ssh trickfire@<server-tailscale-ip>   # should connect (key required)
```

---

## Fail2ban

Bans IPs after repeated failed SSH attempts. Mostly redundant now that SSH is key-only and Tailscale-restricted, but good defence-in-depth.

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

Check status:

```bash
sudo fail2ban-client status sshd
```

---

## Automatic Security Updates

```bash
sudo apt-get install -y unattended-upgrades

cat > /tmp/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
sudo cp /tmp/20auto-upgrades /etc/apt/apt.conf.d/20auto-upgrades
```

Verify:

```bash
sudo unattended-upgrades --dry-run
```

---

## Tailscale ACL (optional)

All machines on the tailnet can currently reach each other (default ACL). SSH is protected by key auth regardless, but you can restrict network-level access further in the Tailscale admin console under **Access Controls**.

Example ACL to allow SSH to the server from one machine only:

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

Get IPs with `tailscale ip -4` on each machine.

---

## Remaining Risks

### Full-disk encryption (LUKS) - not yet done

The NVMe drive has no encryption. Physical access to the machine gives access to:

- `.env.production` (auth secret, encryption key, API keys)
- Cloudflare tunnel credentials (`~/.cloudflared/*.json`)
- GitHub Actions runner token (`~/actions-runner/.env`)
- The SQLite database

This is especially relevant given that hardware theft has occurred in the lab.

**To fix:** reinstall Debian with LUKS full-disk encryption enabled in the installer. Configure a remote unlock mechanism (e.g. Dropbear SSH in initramfs) so the server can reboot unattended and still prompt for the LUKS passphrase over the network.

**Interim mitigations in place:**

- Server is physically better secured than the stolen machine
- Cloudflare credentials are scoped to a single tunnel - revocable from the Cloudflare dashboard
- GitHub runner token can be revoked from the repo settings
- Auth secret and vault key rotation requires a redeploy but no data loss
