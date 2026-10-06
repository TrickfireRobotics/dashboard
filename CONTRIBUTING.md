# Contributing to TrickFire Dashboard

Thanks for contributing. This doc covers the contribution workflow - branch naming, commit messages, and PR etiquette. For everything about the codebase itself (architecture, tech stack, setup, deployment), see the **[docs site](https://docs.trickfirerobotics.com/dashboard/)**:

- [Getting Started](https://docs.trickfirerobotics.com/dashboard/getting-started/) - first-time setup (dev container or local)
- [Architecture Overview](https://docs.trickfirerobotics.com/dashboard/architecture/) - how the codebase is organized
- [Development Setup](https://docs.trickfirerobotics.com/dashboard/guides/development/) - commands, env vars, CI, git hooks
- [Tech Stack](https://docs.trickfirerobotics.com/dashboard/tech-stack/nextjs-typescript/) - a page per framework/library, including [Database](https://docs.trickfirerobotics.com/dashboard/tech-stack/database/) and [Code Quality Tooling](https://docs.trickfirerobotics.com/dashboard/tech-stack/tooling/)
- [Deployment](https://docs.trickfirerobotics.com/dashboard/guides/deploy/) - production setup, updating, backups

If you haven't set up the project yet, start with [Getting Started](https://docs.trickfirerobotics.com/dashboard/getting-started/).

## Development Workflow

1. Branch off `main` using the naming convention below.
2. Make your changes.
3. Run `pnpm check` to catch what CI would catch (lint, format, typecheck, tests - see [Development Setup](https://docs.trickfirerobotics.com/dashboard/guides/development/)).
4. Open a pull request against `main` with a short description of what changed and why.

### Branch Naming

| Type          | Pattern                     | Example              |
| ------------- | --------------------------- | -------------------- |
| Feature       | `feat/<short-description>`  | `feat/order-export`  |
| Bug fix       | `fix/<short-description>`   | `fix/session-expiry` |
| Chore / infra | `chore/<short-description>` | `chore/update-deps`  |

## Commit Messages

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>
```

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature or behaviour                        |
| `fix`      | Bug fix                                         |
| `chore`    | Maintenance, deps, config - no behaviour change |
| `docs`     | Documentation only                              |
| `style`    | Formatting, whitespace - no logic change        |
| `refactor` | Code restructure with no feature or fix         |
| `perf`     | Performance improvement                         |
| `ci`       | CI/CD changes                                   |
| `revert`   | Reverts a previous commit                       |

A commitlint git hook enforces this automatically - bad commits are blocked before they land. The hook is installed by `pnpm install`. See [Code Quality Tooling](https://docs.trickfirerobotics.com/dashboard/tech-stack/tooling/) for what it and the other hooks check. Use `git commit --no-verify` only in genuine emergencies.

## Pull Requests

- **Keep PRs focused** - one concern per PR. A PR that adds a feature and refactors an unrelated component is harder to review and harder to revert.
- **Write a useful description** - explain what changed and why, not just what the diff shows. Link to relevant issues or Slack threads.
- **Schema changes need a migration** - if your PR touches `src/lib/db/schema.ts`, generate the migration (`pnpm db:generate`, see [Database](https://docs.trickfirerobotics.com/dashboard/tech-stack/database/#migrations)) and commit it alongside the schema change in the same commit.

## Adding Pages

Pages live under `src/app/(dashboard)/`. The `(dashboard)` route group applies the authenticated layout automatically.

1. Create `src/app/(dashboard)/<your-route>/page.tsx`
2. Add a nav entry in `src/components/layout/Sidebar.tsx` if it should appear in the sidebar
3. Add a corresponding entry to the `routeLabels` map in `src/components/layout/TopNav.tsx` so the topnav shows the right page title

Admin-only pages go under `src/app/(dashboard)/admin/`. The auth gate in `layout.tsx` only checks authentication - admin-only access must be enforced inside the page or its API routes.

## Shared Fetch with Multiple Grid Cards

When two adjacent cards share a single data fetch (to avoid duplicate requests), wrap them in a container component that uses `className="contents"` (`display: contents`). This makes the wrapper invisible to CSS Grid, so the child cards participate in the outer grid as direct items while the fetch logic lives in one place. See `ServerStatusSection.tsx` for an example.

## Getting Help

Check inline comments first - they're sparse but mark non-obvious behaviour. If the [docs site](https://docs.trickfirerobotics.com/dashboard/) doesn't answer it either, ask in the team Slack.
