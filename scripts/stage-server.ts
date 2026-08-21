// Builds and starts the staging instance on port 3001. Each phase runs behind
// a spinner; on success only a checkmark is printed, on failure the full
// captured output is dumped so the real error is still visible. The `next
// build` step is the one exception - its output is always shown, since the
// route table is worth seeing every run.
//
// BETTER_AUTH_SECRET/BETTER_AUTH_URL are passed into the build itself (not
// just the runtime start) so Better Auth has real config while collecting
// page data - without it, every route logs a "default secret" warning during
// build.

import { spawn } from "node:child_process";
import { cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

const STAGING_ENV_PATH = "/home/trickfire/dashboard/.env.staging";
const PROD_DB = "/home/trickfire/db/dashboard.db";
const CWD = process.cwd();
const STAGING_DB = path.join(CWD, "db", "staging.db");
const PORT = "3001";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

class CommandError extends Error {
    constructor(
        cmd: string,
        readonly code: number,
        readonly output: string
    ) {
        super(`${cmd} exited with code ${code}`);
    }
}

function runCmd(
    cmd: string,
    args: string[],
    opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: opts.cwd,
            env: opts.env ?? process.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const chunks: Buffer[] = [];
        child.stdout.on("data", (d: Buffer) => chunks.push(d));
        child.stderr.on("data", (d: Buffer) => chunks.push(d));
        child.on("error", reject);
        child.on("close", (code) => {
            const output = Buffer.concat(chunks).toString("utf8");
            if (code === 0) resolve(output);
            else reject(new CommandError(`${cmd} ${args.join(" ")}`, code ?? 1, output));
        });
    });
}

function startSpinner(label: string) {
    let i = 0;
    process.stdout.write("\x1b[?25l");
    const timer = setInterval(() => {
        process.stdout.write(`\r${SPINNER_FRAMES[(i = (i + 1) % SPINNER_FRAMES.length)]} ${label}`);
    }, 80);
    return () => {
        clearInterval(timer);
        process.stdout.write("\r\x1b[K\x1b[?25h");
    };
}

async function step<T>(label: string, fn: () => Promise<T> | T, alwaysShow = false): Promise<T> {
    const stopSpinner = startSpinner(label);
    try {
        const result = await fn();
        stopSpinner();
        console.log(`${GREEN}✓${RESET} ${label}`);
        if (alwaysShow && typeof result === "string" && result.trim()) {
            console.log(result.trimEnd());
        }
        return result;
    } catch (err) {
        stopSpinner();
        console.log(`${RED}✗${RESET} ${label}`);
        if (err instanceof CommandError) {
            console.log(err.output.trimEnd());
        } else {
            console.error(err);
        }
        process.exit(1);
    }
}

async function getStagingUrl(): Promise<string> {
    const raw = await runCmd("tailscale", ["status", "--json"]);
    const status = JSON.parse(raw) as { Self: { DNSName: string } };
    return `https://${status.Self.DNSName.replace(/\.$/, "")}`;
}

async function main() {
    const stagingEnv = parseEnv(readFileSync(STAGING_ENV_PATH, "utf8"));
    const stagingUrl = await step("Resolving Tailscale hostname", getStagingUrl);

    const buildEnv = {
        ...process.env,
        ...stagingEnv,
        BETTER_AUTH_URL: stagingUrl,
        DATABASE_PATH: STAGING_DB,
    };

    rmSync(path.join(CWD, ".next"), { recursive: true, force: true });
    await step("Building", () => runCmd("pnpm", ["build"], { cwd: CWD, env: buildEnv }), true);

    await step("Copying static assets", () => {
        cpSync(path.join(CWD, ".next/static"), path.join(CWD, ".next/standalone/.next/static"), {
            recursive: true,
        });
        cpSync(path.join(CWD, "public"), path.join(CWD, ".next/standalone/public"), {
            recursive: true,
        });
    });

    await step("Copying prod database into staging", () => {
        rmSync(STAGING_DB, { force: true });
        rmSync(`${STAGING_DB}-wal`, { force: true });
        rmSync(`${STAGING_DB}-shm`, { force: true });
        return runCmd(
            "pnpm",
            ["exec", "tsx", "scripts/copy-prod-db-for-staging.ts", PROD_DB, STAGING_DB],
            { cwd: CWD }
        );
    });

    const dbEnv = { ...process.env, DATABASE_PATH: STAGING_DB };
    await step("Migrating staging database", () =>
        runCmd("pnpm", ["exec", "drizzle-kit", "migrate"], { cwd: CWD, env: dbEnv })
    );
    await step("Wiping staging sessions", () =>
        runCmd("pnpm", ["exec", "tsx", "scripts/wipe-staging-sessions.ts"], {
            cwd: CWD,
            env: dbEnv,
        })
    );

    console.log("→ Setting up HTTPS via Tailscale Serve (sudo password may be required)");
    const serve = await new Promise<number>((resolve, reject) => {
        const child = spawn("sudo", ["tailscale", "serve", "--bg", PORT], { stdio: "inherit" });
        child.on("error", reject);
        child.on("close", (code) => resolve(code ?? 1));
    });
    if (serve !== 0) {
        console.log(
            `${RED}ERROR: Tailscale Serve failed. Check that Serve is enabled for this tailnet.${RESET}`
        );
        process.exit(1);
    }

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        spawn("sudo", ["tailscale", "serve", "reset"], { stdio: "ignore" });
    };
    process.on("SIGINT", () => {
        cleanup();
        process.exit(130);
    });
    process.on("SIGTERM", () => {
        cleanup();
        process.exit(143);
    });
    process.on("exit", cleanup);

    const label = `Staging: ${stagingUrl}`;
    console.log("");
    console.log(`  ┌${"─".repeat(label.length + 2)}┐`);
    console.log(`  │ ${label} │`);
    console.log(`  └${"─".repeat(label.length + 2)}┘`);
    console.log("");

    const runtimeEnv = {
        ...process.env,
        ...stagingEnv,
        BETTER_AUTH_URL: stagingUrl,
        PORT,
        DATABASE_PATH: STAGING_DB,
    };
    await new Promise<void>((resolve) => {
        const server = spawn("/usr/bin/node", [".next/standalone/server.js"], {
            cwd: CWD,
            env: runtimeEnv,
            stdio: "inherit",
        });
        server.on("close", () => resolve());
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
