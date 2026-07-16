#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Ensuring database directory exists..."
DB_PATH=$(grep -E '^DATABASE_PATH=' .env.production 2>/dev/null | head -1 | cut -d= -f2-)
[ -n "$DB_PATH" ] && mkdir -p "$(dirname "$DB_PATH")"

echo "==> Running database migrations..."
pnpm exec drizzle-kit migrate

echo "==> Building..."
rm -rf .next
pnpm build

echo "==> Copying static assets into standalone output..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "==> Restarting service..."
sudo systemctl restart trickfire-dashboard

echo ""
echo "Done"
