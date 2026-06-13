#!/usr/bin/env bash
# Build and start a staging instance on port 3001
# Uses the same .env.production config as the live service
set -euo pipefail

echo "==> Building..."
rm -rf .next
pnpm build

echo "==> Copying static assets into standalone output..."
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public

PROD_ENV="/home/trickfire/dashboard/.env.production"
STAGING_DB="$(pwd)/db/staging.db"

FIRST_RUN=false
[ ! -f "$STAGING_DB" ] && FIRST_RUN=true

echo "==> Migrating staging database..."
DATABASE_PATH="$STAGING_DB" pnpm exec drizzle-kit migrate

if $FIRST_RUN; then
    echo "==> Seeding staging database (first run)..."
    DATABASE_PATH="$STAGING_DB" \
    SEED_ADMIN_EMAIL="admin@admin.local" \
    SEED_ADMIN_PASSWORD="trickfire" \
    pnpm exec tsx scripts/seed.ts
fi

echo "==> Setting up HTTPS via Tailscale serve..."
TS_HOST=$(tailscale status --json | python3 -c "import sys,json; s=json.load(sys.stdin); print(s['Self']['DNSName'].rstrip('.'))")
STAGING_URL="https://$TS_HOST"
if ! sudo tailscale serve --bg 3001 2>&1; then
    echo ""
    echo "  ERROR: Tailscale Serve failed. Check that Serve is enabled for this tailnet."
    exit 1
fi
trap 'sudo tailscale serve reset' EXIT

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  Staging: $STAGING_URL│"
echo "  └─────────────────────────────────────────────┘"
echo ""

BETTER_AUTH_URL="$STAGING_URL" \
PORT=3001 DATABASE_PATH="$STAGING_DB" \
/usr/bin/node --env-file="$PROD_ENV" .next/standalone/server.js
