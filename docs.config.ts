import { defineConfig } from "trickfire-docs";

export default defineConfig({
    name: "TrickFire Dashboard",
    description:
        "Internal portal for TrickFire Robotics - part orders, Minecraft whitelist, and club integrations.",
    landing: [
        {
            title: "Getting Started",
            description: "Set up the project locally and log in for the first time.",
            link: "/getting-started/",
        },
        {
            title: "Architecture Overview",
            description: "How the app is put together: folders, request flow, auth guarding.",
            link: "/architecture/",
        },
        {
            title: "Tech Stack",
            description: "Every framework and library we use, and how we actually use it here.",
            link: "/tech-stack/nextjs-typescript/",
        },
        {
            title: "Development Guide",
            description: "Commands, environment variables, CI, git hooks, and the API key vault.",
            link: "/guides/development/",
        },
        {
            title: "Deployment Guide",
            description: "Production setup on the server, updating, backups, troubleshooting.",
            link: "/guides/deploy/",
        },
        {
            title: "Server Hardening",
            description: "SSH, firewall, fail2ban, and automatic security updates.",
            link: "/guides/server-hardening/",
        },
    ],
    sidebar: [
        { label: "Getting Started", slug: "getting-started" },
        { label: "Architecture Overview", slug: "architecture" },
        {
            label: "Tech Stack",
            items: [
                { label: "Next.js & TypeScript", slug: "tech-stack/nextjs-typescript" },
                { label: "Styling & UI Components", slug: "tech-stack/styling-ui" },
                { label: "Forms & Validation", slug: "tech-stack/forms-validation" },
                { label: "Database (Drizzle + SQLite)", slug: "tech-stack/database" },
                { label: "Authentication & Authorization", slug: "tech-stack/auth" },
                { label: "Security (Vault, API Keys, Rate Limiting)", slug: "tech-stack/security" },
                { label: "Testing (Vitest)", slug: "tech-stack/testing" },
                { label: "Code Quality Tooling", slug: "tech-stack/tooling" },
                { label: "Observability (Sentry & Uptime)", slug: "tech-stack/observability" },
                { label: "External Integrations", slug: "tech-stack/external-integrations" },
            ],
        },
        {
            label: "Guides",
            items: [
                { label: "Development Setup", slug: "guides/development" },
                { label: "Deployment", slug: "guides/deploy" },
                { label: "Server Integrations Setup", slug: "guides/integrations" },
                { label: "Server Hardening", slug: "guides/server-hardening" },
            ],
        },
    ],
});
