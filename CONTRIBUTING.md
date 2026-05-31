# Contributing

## Development workflow

1. Branch off `main` using the naming scheme below
2. Make your changes
3. Ensure lint and formatting pass before pushing
4. Open a pull request against `main`

## Branch naming

| Type          | Pattern                     | Example              |
| ------------- | --------------------------- | -------------------- |
| Feature       | `feat/<short-description>`  | `feat/order-export`  |
| Bug fix       | `fix/<short-description>`   | `fix/session-expiry` |
| Chore / infra | `chore/<short-description>` | `chore/update-deps`  |

## Code style

This project uses ESLint and Prettier. Both run automatically in CI and on save in VS Code (with the recommended extensions installed).

Before pushing, verify locally:

```bash
pnpm lint          # ESLint
pnpm format:check  # Prettier
```

To auto-fix formatting:

```bash
pnpm format
```

## Pull requests

- Keep PRs focused - one concern per PR
- Include a short description of what changed and why
- If the PR touches the database schema, run `pnpm db:generate` and commit the resulting migration file alongside the schema change

## Schema changes

Always pair a schema edit with a generated migration:

```bash
# 1. Edit src/lib/db/schema.ts
# 2. Generate the migration
pnpm db:generate
# 3. Commit both files together
```

Never edit migration files by hand after they've been committed.
