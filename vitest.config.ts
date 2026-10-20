import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        environment: "node",
        // Suites that touch the db share one sqlite file, so run files one at a
        // time rather than letting workers fight over the write lock.
        fileParallelism: false,
        env: {
            DATABASE_PATH: "db/test.db",
        },
        globalSetup: ["./vitest.global-setup.ts"],
    },
});
