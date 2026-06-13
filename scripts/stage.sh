#!/usr/bin/env bash
# Run locally — rsyncs local working tree to the server (including uncommitted
# changes), builds, and starts staging on port 3001.
# Browse to http://tfserver:3001 via Tailscale. Ctrl+C to stop.
set -euo pipefail

SERVER="trickfire@tfserver"
REMOTE_DIR="/home/trickfire/dashboard-staging"
PROD_DIR="/home/trickfire/dashboard"

echo "==> Syncing local code to server..."
echo " remote: $SERVER:$REMOTE_DIR"
echo " local: $(pwd)"
rsync -az --delete \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='.next/' \
    --exclude='/db/' \
    --exclude='.env*' \
    . "$SERVER:$REMOTE_DIR/"

echo "==> Building and starting staging..."
ssh -t "$SERVER" "cd '$REMOTE_DIR' && pnpm install --frozen-lockfile && bash scripts/stage-server.sh"
