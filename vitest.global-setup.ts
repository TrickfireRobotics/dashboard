import { execSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TEST_DB_PATH = resolve(process.cwd(), "db/test.db");

function removeDbFiles(path: string) {
    for (const file of [path, `${path}-wal`, `${path}-shm`]) {
        if (existsSync(file)) unlinkSync(file);
    }
}

export default function setup() {
    mkdirSync(dirname(TEST_DB_PATH), { recursive: true });
    removeDbFiles(TEST_DB_PATH);

    execSync("pnpm db:migrate", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
    });
}
