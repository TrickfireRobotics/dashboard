---
title: Observability (Sentry & Uptime)
description: Error tracking with Sentry across all three Next.js runtimes, and the Cloudflare Worker that watches production uptime.
---

## Error tracking - Sentry

[Sentry](https://sentry.io/) captures unhandled exceptions (and, here, logs) from a running app and reports them to a dashboard with a stack trace, request context, and grouping across occurrences - instead of errors only being visible in server logs you have to be actively watching.

Next.js has three separate JavaScript runtimes an error can occur in, and `@sentry/nextjs` requires a separate init file for each:

| File                      | Runtime                            | `tracesSampleRate`          |
| ------------------------- | ---------------------------------- | --------------------------- |
| `sentry.client.config.ts` | Browser                            | `0.1` (10% of transactions) |
| `sentry.server.config.ts` | Node.js server                     | `0.1`                       |
| `sentry.edge.config.ts`   | Edge (middleware, if it ran there) | `1` (100%)                  |

All three share the same DSN and set `enableLogs: true` (forward `console`-style logs to Sentry, not just thrown exceptions) and `sendDefaultPii: true` (include request/user context to make errors easier to reproduce - be mindful of this if handling more sensitive data in the future).

```ts title="sentry.client.config.ts"
Sentry.init({
    dsn: "https://...@o4511577249021952.ingest.us.sentry.io/4511577305317376",
    tracesSampleRate: 0.1,
    enableLogs: true,
    sendDefaultPii: true,
});
```

`tracesSampleRate` controls what fraction of requests get full performance tracing (not just error capture) - sampling client/server at 10% keeps overhead and Sentry quota usage low for routine traffic, while the edge runtime (middleware, which runs on every matched request) is sampled at 100% since it's comparatively low-volume and cheap to trace fully.

### Build-time wiring (`next.config.ts`)

```ts
export default withSentryConfig(nextConfig, {
    org: "trickfire-robotics",
    project: "dashboard",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: "/api/intake",
    webpack: { treeshake: { removeDebugLogging: true } },
});
```

- **`tunnelRoute: "/api/intake"`** - client-side error reports are proxied through this app's own `/api/intake` route instead of going straight to `ingest.sentry.io`. This avoids ad blockers and browser privacy extensions silently dropping error reports (many block requests to known telemetry domains by hostname).
- **`widenClientFileUpload`** + the plugin's default behavior uploads source maps at build time (via `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`, only needed in the build environment, not at runtime) so stack traces in Sentry show your actual TypeScript source rather than minified bundle output.
- **`removeDebugLogging`** strips Sentry's own debug console output from the production bundle via tree-shaking.

## Uptime monitoring - Cloudflare Worker (`health/`)

Sentry tells you about errors _while the app is running_. It can't tell you the app has stopped responding entirely - for that, a small [Cloudflare Worker](https://developers.cloudflare.com/workers/) (`health/src/index.js`) runs independently, on Cloudflare's edge, unaffected by an outage on the actual server:

```toml title="health/wrangler.toml"
[triggers]
crons = ["*/5 * * * *"]   # every 5 minutes
```

Each run fetches `https://dashboard.trickfirerobotics.com/api/health` with a 10-second timeout and expects an `ok` response body. On failure, it waits 5 seconds and retries once (to avoid alerting on a single transient blip) before treating the dashboard as down. If still down, it posts a Discord embed - pinging a fixed set of Discord user IDs (`PING_IDS`), with the failure reason and a UTC timestamp - to a webhook URL stored as a Worker secret, never in source:

```bash title="Terminal"
cd health
pnpm dlx wrangler deploy
pnpm dlx wrangler secret put DISCORD_WEBHOOK_URL
```

The Worker's `fetch` handler also responds to a direct HTTP request to the Worker's own URL, which is useful for triggering an out-of-schedule check while testing changes to the alerting logic. To change who gets pinged, edit `PING_IDS` in `health/src/index.js` and redeploy.
