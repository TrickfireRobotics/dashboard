---
title: Architecture Overview
description: How the codebase is organized, how a request flows through it, and how access control is layered.
---

This page is a map of the codebase. It assumes you've read [Getting Started](/getting-started/) and know how to run the app - here we look at _how it's built_.

## The shape of the app in one sentence

It's a single Next.js app (no separate backend service) that renders pages on the server, talks directly to a local SQLite file through Drizzle ORM, and exposes a set of JSON API routes for anything that needs to be called from the browser after the page has loaded.

## Top-level `src/` layout

| Folder           | Purpose                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`        | Every route: pages, layouts, and API route handlers (Next.js App Router - see [Next.js & TypeScript](/tech-stack/nextjs-typescript/)).                                                                                                                                                                                                          |
| `src/components` | Client-facing UI, one subfolder per feature area (`admin`, `auth`, `dashboard`, `finance`, `github`, `minecraft`, `network`, `onshape`, `orders`, `settings`, `vault`, `layout`) plus `ui` for the shadcn/ui primitives.                                                                                                                        |
| `src/lib`        | Everything that isn't UI: `auth/` (better-auth setup + session helpers), `db/` (Drizzle schema + SQLite client), `finance/`, `integrations/` (GitHub, OnShape, Minecraft/Azalea, email), `security/` (vault crypto, API-key hashing, rate limiting), plus small root-level modules (`features.ts`, `use-poll.ts`, `utils.ts`, `validation.ts`). |

There's no `src/hooks` or `src/types` folder - the one meaningful custom hook (`usePoll`) lives in `src/lib`, and types are defined next to the schema/integration code they belong to rather than centralized.

## `src/app` structure

```
src/app/
├── (auth)/            # /login, /pending - unauthenticated flow, own layout
├── (dashboard)/       # everything behind auth - own layout
│   ├── dashboard/
│   ├── orders/[id]/edit, orders/new
│   ├── api-keys/
│   ├── minecraft/
│   ├── network/
│   ├── features/
│   ├── settings/
│   └── admin/         # nested layout re-checks role === "admin"
│       ├── finance/ github/ minecraft/ network/ onshape/ orders/ server/ users/
├── pl3xmap/[[...path]]  # Minecraft map proxy - relaxed CSP, no auth group
├── sentry-example-page/
└── api/               # route handlers - see the tech-stack pages for details
```

The two parenthesized folders - `(auth)` and `(dashboard)` - are [Next.js route groups](/tech-stack/nextjs-typescript/#route-groups-and-layouts): they organize routes and give each area its own `layout.tsx` without adding a `/auth` or `/dashboard` segment to the URL.

## How a page request is authorized (three layers)

Access control isn't handled in one place - it's layered, and each layer exists for a different reason:

1. **`src/middleware.ts`** runs first, before any page renders, for everything matched by its `matcher` (`/dashboard`, `/orders`, `/minecraft`, `/network`, `/features`, `/api-keys`, `/admin` - notably _not_ `/api/*`). It checks the session cookie via `auth.api.getSession()`, redirects to `/login` if missing or the account is deactivated, to `/pending` if not yet approved, and for non-admins, checks the requested path against `FEATURE_ROUTES` (in `src/lib/features.ts`) against a `userFeature` grant in the database.
2. **`(dashboard)/admin/layout.tsx`** re-checks `role === "admin"` as a server component, independent of the middleware. This is defense in depth - if the middleware matcher were ever misconfigured, the admin section still guards itself.
3. **Individual API route handlers** each call `getSessionUser()` and re-check role/`isActive` themselves, because `/api/*` isn't covered by the middleware at all. This is why you'll see the same-looking auth check copy-pasted at the top of many `route.ts` files rather than factored into one shared function - see [Authentication & Authorization](/tech-stack/auth/) for why, and where the vault endpoints add an extra check on top.

## Data fetching pattern

- **Server components** (most `page.tsx` and `layout.tsx` files) query the database directly - `db.select(...).from(...).get()` - inside an `async` component. No API call, no client-side loading state, no waterfall.
- **Client components** that need live or interactive data call an API route (e.g. a Minecraft status tile polling `/api/minecraft/status` via the `usePoll` hook in `src/lib/use-poll.ts`), because a server component can't re-fetch on an interval without a full page reload.

Only three files in the entire `src/app` tree are `"use client"` at the page/layout level (`global-error.tsx`, the dashboard `error.tsx`, and the Sentry example page) - all three are boundaries Next.js or Sentry require to be client components. Everything else that needs interactivity is a small client component imported _into_ a server page, not the page itself.

## Where each concern is documented

| Concern                                                          | Page                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Next.js routing, server/client components, `next.config.ts`      | [Next.js & TypeScript](/tech-stack/nextjs-typescript/)      |
| Tailwind v4, shadcn/ui, icons, toasts                            | [Styling & UI Components](/tech-stack/styling-ui/)          |
| Forms and input validation                                       | [Forms & Validation](/tech-stack/forms-validation/)         |
| Schema, migrations, seeding                                      | [Database](/tech-stack/database/)                           |
| Sessions, roles, feature grants                                  | [Authentication & Authorization](/tech-stack/auth/)         |
| Vault encryption, API keys, rate limiting                        | [Security](/tech-stack/security/)                           |
| Unit tests                                                       | [Testing](/tech-stack/testing/)                             |
| Linting, formatting, git hooks, CI                               | [Code Quality Tooling](/tech-stack/tooling/)                |
| Error tracking, uptime monitoring                                | [Observability](/tech-stack/observability/)                 |
| Minecraft/RCON, GitHub, Resend, OnShape, Tailscale, system stats | [External Integrations](/tech-stack/external-integrations/) |
