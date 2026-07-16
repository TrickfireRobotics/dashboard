---
title: Testing (Vitest)
description: How the test suite is configured and what it actually covers.
---

## What Vitest is

[Vitest](https://vitest.dev/) is a test runner - it finds `*.test.ts` files, runs the `describe`/`it`/`expect` blocks inside them, and reports pass/fail. It's built on the same underlying tooling as Vite (fast, native ESM, no separate transpile step needed for TypeScript), which is why it's a common pairing with modern TS projects instead of older runners like Jest.

## Configuration (`vitest.config.ts`)

```ts
export default defineConfig({
    resolve: { tsconfigPaths: true },
    test: {
        environment: "node",
        env: { DATABASE_PATH: "db/test.db" },
        globalSetup: ["./vitest.global-setup.ts"],
    },
});
```

- **`environment: "node"`** - tests run in a plain Node.js context, not a simulated browser (there's no `jsdom`/`happy-dom` here, so this suite doesn't render React components - see "What's tested" below).
- **`DATABASE_PATH: "db/test.db"`** - tests run against a completely separate SQLite file from your dev database (`db/dashboard.db`), so running the suite never touches data you're looking at in the app.
- **`globalSetup`** runs once before the whole suite, not per-file or per-test.

### `vitest.global-setup.ts` - a real, migrated database

```ts
export default function setup() {
    mkdirSync(dirname(TEST_DB_PATH), { recursive: true });
    removeDbFiles(TEST_DB_PATH); // delete db/test.db (+ -wal/-shm)
    execSync("pnpm db:migrate", {
        env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
    });
}
```

Every test run starts by deleting and recreating `db/test.db`, then applying every real migration against it. This is a deliberate choice: tests that touch the database run against an actual migrated SQLite file with real constraints (foreign keys, uniqueness) enforced, rather than a mocked DB client that could silently diverge from what production actually enforces.

## What's actually tested

The current suite is **unit tests of pure/business logic**, not integration tests of API routes or component rendering. Look at `src/lib/utils.test.ts` for the shape:

```ts
describe("formatPriceCents", () => {
    it("formats typical cents as USD", () => {
        expect(formatPriceCents(1050)).toBe("$10.50");
    });
    it("returns dash for null", () => {
        expect(formatPriceCents(null)).toBe("-");
    });
});
```

Table-driven `describe`/`it` blocks, one behavior per `it`, explicitly covering edge cases (`null`, `undefined`, zero, large values) rather than only the happy path. Other test files follow the same shape for their respective modules: `src/lib/finance/{finance,order-pricing,order-export}.test.ts` (pricing/budget math), `src/lib/security/{api-key,rate-limit,vault-crypto}.test.ts` (the security helpers described in [Security](/tech-stack/security/)), `src/lib/validation.test.ts`.

If you're adding logic to a `src/lib/**` module, add a co-located `<name>.test.ts` next to it following this pattern - that's the existing convention, not a new one to invent.

## Commands

| Command              | What it does                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm test`          | Run the whole suite once (`vitest run`) - this is what CI runs on every push/PR to `main`. |
| `pnpm test:watch`    | Re-run affected tests on save - use this while actively writing code.                      |
| `pnpm test:ui`       | Open Vitest's browser UI for interactively exploring test results.                         |
| `pnpm test:coverage` | Generate a coverage report via `@vitest/coverage-v8`.                                      |
