import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_PATH) {
    for (const f of [".env.local", ".env.production"]) {
        try {
            process.loadEnvFile(f);
            break;
        } catch {
            /* try next */
        }
    }
}

export default defineConfig({
    dialect: "sqlite",
    schema: "./src/lib/db/schema.ts",
    out: "./drizzle/migrations",
    dbCredentials: {
        url: process.env.DATABASE_PATH ?? "db/dashboard.db",
    },
});
