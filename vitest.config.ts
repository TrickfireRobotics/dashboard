import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        environment: "node",
        env: {
            DATABASE_PATH: "db/test.db",
        },
        globalSetup: ["./vitest.global-setup.ts"],
    },
});
