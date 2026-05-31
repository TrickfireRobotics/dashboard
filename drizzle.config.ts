import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_PATH) {
    try {
        process.loadEnvFile(".env.local");
    } catch {
        // no .env.local - rely on process env
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
