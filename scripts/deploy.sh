#!/usr/bin/env bash
# Run on the Xavier after `git pull` to rebuild and restart the dashboard.
set -euo pipefail

# Load production env so DATABASE_PATH and other vars are available here too.
if [ -f .env.production ]; then
    set -a
    # shellcheck disable=SC1091
    source .env.production
    set +a
fi

echo "==> Installing / updating dependencies..."
pnpm install --frozen-lockfile

echo "==> Ensuring database directory exists..."
mkdir -p "$(dirname "$DATABASE_PATH")"

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
