# TrickFire Dashboard

Internal portal for [TrickFire Robotics](https://trickfirerobotics.com). Members submit part orders and Minecraft whitelist requests; admins review and action them. A service API used by simulation scripts is also exposed through the same server.

## Tech Stack

| Layer           | Choice                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Next.js 15](https://nextjs.org/) - App Router, React Server Components, `output: "standalone"`                      |
| Database        | SQLite via [Drizzle ORM](https://orm.drizzle.team) + [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)  |
| Auth            | [better-auth](https://www.better-auth.com) - email/password, session cookies                                         |
| UI              | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com), [Lucide icons](https://lucide.dev/) |
| Email           | [Resend](https://resend.com)                                                                                         |
| Network         | [Tailscale](https://tailscale.com) - shared tailnet                                                                  |
| Package manager | [`pnpm`](https://pnpm.io/)                                                                                           |

## Docs

Full documentation site: **[docs.trickfirerobotics.com/dashboard](https://docs.trickfirerobotics.com/dashboard/)** - getting started, architecture overview, and a page per framework/library explaining what it is and how we use it here.

- [**Developer notes**](docs/guides/development.md) - dev env setup, environment notes
- [**Deployment guide**](docs/guides/deploy.md) - production setup, updating, backups, troubleshooting
- [**Integrations**](docs/guides/integrations.md) - Tailscale, Minecraft server, Pl3xMap
- [**Server hardening**](docs/guides/server-hardening.md) - SSH, firewall, fail2ban, auto-updates
- [**Contributing**](CONTRIBUTING.md) - workflow, branch naming, code style, PR guidelines
