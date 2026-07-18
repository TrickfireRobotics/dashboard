---
title: Authentication & Authorization
description: better-auth setup, sessions, roles, feature grants, and where each access check actually lives.
---

## What better-auth is

[better-auth](https://www.better-auth.com) is a self-hosted authentication library for TypeScript apps - it handles password hashing, session cookies, email verification, and password reset for you, storing everything in _your own database_ through an adapter (here, the Drizzle adapter) rather than depending on a third-party auth provider. You own the user table and the data; better-auth just provides the (well-tested, security-sensitive) logic around it.

It's worth distinguishing two related but different ideas this page covers:

- **Authentication** - "who is this user?" (better-auth's job: sessions, login, verification)
- **Authorization** - "is this user allowed to do this?" (this app's job: roles, feature grants, vault access - built on top of the session better-auth provides)

## Server configuration (`src/lib/auth/auth.ts`)

```ts
export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    plugins: [emailOTP({ otpLength: 6, expiresIn: 600 })],
    user: {
        additionalFields: {
            role: { type: "string", defaultValue: "member", input: false },
            isActive: { type: "boolean", defaultValue: true, input: false },
            canAccessVault: { type: "boolean", defaultValue: false, input: false },
            approved: { type: "boolean", defaultValue: false, input: false },
        },
        changeEmail: { enabled: true },
    },
    trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(","),
});
```

Key points:

- **`emailAndPassword`** is the only sign-in method - no OAuth/social login is configured.
- **`requireEmailVerification: true`** means a new account can't log in until it clicks a verification link/code.
- **The `emailOTP` plugin** is reused for two purposes: verifying a new email address, and resetting a forgotten password - both send a 6-digit code (`sendEmail`, via [Resend](/tech-stack/external-integrations/#resend-transactional-email)) rather than a magic link.
- **`additionalFields`** all have `input: false` - this means a client **cannot** set these fields through the normal sign-up/update-profile API, even if it tries to send them in the request body. They can only be changed by server-side code writing to the database directly (e.g. an admin API route, or the seed script). This is the whole security model for roles: a user cannot promote themselves to admin by crafting a request.

### What each additional field means

| Field            | Default    | Meaning                                                                                                                                                          |
| ---------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`           | `"member"` | `"member"` or `"admin"` - checked throughout the app wherever admin-only UI or API access is gated.                                                              |
| `isActive`       | `true`     | Set `false` to deactivate an account without deleting it - `middleware.ts` immediately redirects deactivated users to `/login` and clears their session cookies. |
| `approved`       | `false`    | New sign-ups aren't approved by default - unapproved users are redirected to `/pending` until an admin approves them.                                            |
| `canAccessVault` | `false`    | Whether this user can open the API Key Vault page at all (separate from _which_ vault entries they can read - see [Security](/tech-stack/security/)).            |

### Regenerating the schema

`src/lib/db/auth-schema.ts` (the `user`/`session`/`account`/`verification` tables) is generated from this config, not hand-written:

```bash title="Terminal"
pnpm auth:generate
```

Run this after changing anything in `auth.ts` that affects the user shape (like adding another `additionalFields` entry), then run `pnpm db:generate` + `pnpm db:migrate` as usual to turn the resulting schema change into an applied migration.

## Client side (`src/lib/auth/client.ts`)

```ts
export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<typeof auth>(), emailOTPClient()],
});
export const { signIn, signOut, signUp, useSession } = authClient;
```

`inferAdditionalFields<typeof auth>()` is what gives `useSession()` correct TypeScript types for `role`/`isActive`/`approved`/`canAccessVault` on the client, inferred from the same server config rather than redeclared.

## The three layers of access control

This is covered in more depth in [Architecture Overview](/architecture/#how-a-page-request-is-authorized-three-layers) - summarized here from the auth side:

1. **`middleware.ts`** - session exists? active? approved? (for non-admins) does a `userFeature` grant exist for this route, per `FEATURE_ROUTES` in `src/lib/features.ts`?
2. **`(dashboard)/admin/layout.tsx`** - re-checks `role === "admin"` as a server component.
3. **Every `api/admin/**/route.ts`and other sensitive route handler** - calls`getSessionUser()` (`src/lib/auth/session.ts`) and checks `role`/`isActive`itself, since middleware doesn't cover`/api/\*`.

There is currently no single shared `requireAdmin()` helper - the same-shaped check is repeated per route handler. If you're adding a new admin API route, copy the pattern from a neighboring `api/admin/*/route.ts` file rather than inventing a new shape.

### Helpers in `src/lib/auth/session.ts`

```ts
export async function getSessionUser() {
    /* wraps auth.api.getSession({ headers }) */
}
export function canUseVault(user): boolean {
    /* admin, or user.canAccessVault */
}
export function canReadVaultEntry(user, entryId): boolean {
    /* admin, or a matching vaultEntryAccess row */
}
```

## Feature grants (`userFeature` table + `src/lib/features.ts`)

Some routes aren't purely admin/member - they're gated behind a per-user, per-feature grant (e.g. a member might be granted access to `/minecraft` without being an admin). `FEATURE_ROUTES` maps a URL prefix to a feature key; `middleware.ts` checks whether the current user has a `userFeature` row for that key with `status: "granted"`. Users without a grant land on `/features?denied=<key>`, where they can request access.
