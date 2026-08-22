import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.PORT) {
    const envPath = resolve(process.cwd(), ".env.local");
    if (existsSync(envPath)) {
        const match = readFileSync(envPath, "utf8").match(/^NEXT_PUBLIC_APP_URL\s*=\s*(.+)$/m);
        const port = match && new URL(match[1].trim()).port;
        if (port) process.env.PORT = port;
    }
}

const child = spawn("next", ["dev"], { stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
});
