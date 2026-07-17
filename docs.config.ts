import { defineConfig } from "trickfire-docs";

export default defineConfig({
    name: "TrickFire Dashboard",
    description:
        "Internal portal for TrickFire Robotics - part orders, Minecraft whitelist, and club integrations.",
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
