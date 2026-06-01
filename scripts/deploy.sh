#!/usr/bin/env bash
# Run on the Xavier after `git pull` to rebuild and restart the dashboard.
set -euo pipefail

echo "==> Installing / updating dependencies..."
pnpm install --frozen-lockfile

echo "==> Running database migrations..."
pnpm exec drizzle-kit migrate

echo "==> Building..."
rm -rf .next
pnpm build

echo "==> Copying static assets into standalone output..."
cp -r .next/static   .next/standalone/.next/static
cp -r public         .next/standalone/public

echo "==> Restarting service..."
sudo systemctl restart trickfire-dashboard

echo ""
echo "Deploy complete. Check status with:"
echo "  sudo systemctl status trickfire-dashboard"
echo "  journalctl -u trickfire-dashboard -f"
