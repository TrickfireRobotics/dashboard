---
title: Next.js & TypeScript
description: What Next.js and TypeScript are, and how this project's App Router, routing, and server/client split work.
---

## TypeScript, briefly

TypeScript is JavaScript with an optional type system checked at compile time. It doesn't exist at runtime - `tsc` (or, here, Next.js's built-in compiler) strips the types away and emits plain JavaScript. The types exist purely to catch mistakes before the code runs and to make editor autocomplete/refactoring reliable.

This project runs with `"strict": true` in `tsconfig.json`, which turns on the full set of stricter checks (no implicit `any`, strict null checks, etc.) - if a value can be `null` or `undefined`, the compiler forces you to handle that case rather than trusting you remembered to.

Two settings worth knowing about:

- **Path alias**: `"@/*"` maps to `./src/*`, so `import { db } from "@/lib/db"` resolves to `src/lib/db`, no matter how deeply nested the importing file is. Always prefer this over relative `../../../` imports.
- `pnpm typecheck` runs `tsc --noEmit` - it type-checks the whole project without producing output files (Next.js's own build step does the actual compilation). This is part of `pnpm check`.

## What Next.js is

[Next.js](https://nextjs.org/) is a React framework: it takes React (the library for building UI out of components) and adds the parts a real application needs around it - file-based routing, server-side rendering, API endpoints, and a build/bundling pipeline - so you don't have to hand-assemble those from separate tools.

This project uses **Next.js 16 (App Router)** - the routing convention based on folders under `src/app`, as opposed to the older `pages/` router.

## The App Router mental model

- Every folder under `src/app` is a URL segment. A file named `page.tsx` inside a folder makes that segment a visible route.
- A `layout.tsx` in a folder wraps every `page.tsx` beneath it (and persists across navigations between its children - it doesn't remount).
- A `route.ts` file makes that segment an **API endpoint** instead of a page - it exports functions named after HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`) instead of a default component.

### Route groups and layouts

Folders wrapped in parentheses, like `(auth)` and `(dashboard)`, are **route groups**: they let you nest a `layout.tsx` around a set of routes without that folder name becoming part of the URL. `src/app/(dashboard)/orders/page.tsx` is served at `/orders`, not `/(dashboard)/orders`. This project uses exactly two: `(auth)` for the logged-out flow (`/login`, `/pending`) and `(dashboard)` for everything behind authentication. See [Architecture Overview](/architecture/) for the full tree.

### Server components vs. client components

By default, every component in the App Router is a **React Server Component (RSC)** - it renders on the server, can be `async`, can query the database directly, and never ships its own JavaScript to the browser. Add `"use client"` at the top of a file to opt a component into being a **client component** - one that also runs in the browser, can use `useState`/`useEffect`/event handlers, but is compiled into the JS bundle sent to the user.

This codebase is server-first almost everywhere: `page.tsx` files are async server components that query Drizzle directly (`db.select(...).from(...).get()`), and `"use client"` only appears on the handful of files that genuinely need interactivity (form inputs, buttons with click handlers, anything polling an API route). Reusable interactive widgets live under `src/components/**` as client components imported into server pages, keeping the "use client" boundary as small and as deep in the tree as possible - this is deliberate, since every client component adds to the JS bundle the browser has to download and run, while server components don't.

### Route handlers (API routes)

Files at `src/app/api/**/route.ts` are plain HTTP endpoints, used by client components that need to fetch or mutate data after the initial page load (e.g. a form's submit handler `POST`ing to `/api/orders`, or a status tile polling `/api/minecraft/status` every few seconds). They receive a standard `NextRequest`/`Request` and return a `NextResponse`/`Response` - there's no framework-specific request object to learn. Nearly every handler in this project independently checks the caller's session and role, since `/api/*` isn't covered by `middleware.ts` (see [Authentication & Authorization](/tech-stack/auth/)).

### Middleware

`src/middleware.ts` runs before matched routes render, on the Node.js runtime (`export const runtime = "nodejs"`, required here because it queries the database, which the default Edge runtime can't do). It's the first of three authorization layers described in [Architecture Overview](/architecture/#how-a-page-request-is-authorized-three-layers).

## `next.config.ts` - the notable bits

- **`output: "standalone"`** - produces a minimal, self-contained server bundle (`node .next/standalone/server.js`) instead of requiring the full `node_modules` tree and Next.js CLI in production. See the [Deployment guide](/guides/deploy/) for the exact copy steps this requires.
- **`serverExternalPackages: ["better-sqlite3", "systeminformation"]`** - tells Next.js not to try to bundle these two native/Node-specific packages; they're loaded from `node_modules` at runtime instead, which is required for their compiled/native bindings to work.
- **Security headers** - a `headers()` function sets HSTS, a Content-Security-Policy, `X-Frame-Options: DENY`, and a Permissions-Policy on every route, with a deliberately relaxed set (no CSP/`X-Frame-Options`) scoped to `/pl3xmap/*` so the Minecraft map can be embedded.
- **`withSentryConfig(...)`** wraps the whole config to wire up source map uploads and the Sentry webpack plugin - see [Observability](/tech-stack/observability/).

## Commands

| Command          | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Start the dev server with hot reload.                        |
| `pnpm build`     | Production build (respects `output: "standalone"`).          |
| `pnpm start`     | Start the production server - requires a prior `pnpm build`. |
| `pnpm typecheck` | `tsc --noEmit` - type-check without emitting files.          |
