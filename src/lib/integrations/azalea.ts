import { execSync, spawn } from "child_process";
import {
    appendFileSync,
    closeSync,
    existsSync,
    openSync,
    readFileSync,
    readSync,
    statSync,
    writeFileSync,
} from "fs";
import { createInterface } from "readline";
import * as path from "path";
import { RCON } from "minecraft-server-util";

export type LogEvent = { type: "line"; line: string } | { type: "reset" };

const dashboardLogBuffer: string[] = [];
const MAX_DASHBOARD_LINES = 200;
const dashboardListeners = new Set<(event: LogEvent) => void>();

function serverDir() {
    return process.env.MINECRAFT_SERVER_PATH ?? "";
}

function configPath() {
    return path.join(serverDir(), "azalea-server.json");
}

function serverLogFile() {
    return path.join(serverDir(), "logs", "latest.log");
}

function rconHost() {
    return process.env.MINECRAFT_SERVER_HOST ?? "localhost";
}

function rconPort() {
    return Number(process.env.MINECRAFT_RCON_PORT ?? 25575);
}

function rconPassword() {
    return process.env.MINECRAFT_RCON_PASSWORD ?? "";
}

function pushDashboardLog(line: string) {
    dashboardLogBuffer.push(line);
    if (dashboardLogBuffer.length > MAX_DASHBOARD_LINES) dashboardLogBuffer.shift();
    dashboardListeners.forEach((fn) => {
        try {
            fn({ type: "line", line });
        } catch {}
    });
}

export function isRunning(): boolean {
    try {
        execSync("systemctl is-active --quiet minecraft");
        return true;
    } catch {
        return false;
    }
}

export function startServer(): { ok: boolean; error?: string } {
    if (!isConfigured()) return { ok: false, error: "Server is not configured" };
    if (isRunning()) return { ok: false, error: "Server is already running" };
    try {
        execSync("sudo systemctl start minecraft");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

export function stopServer(): { ok: boolean; error?: string } {
    if (!isRunning()) return { ok: false, error: "Server is not running" };
    try {
        execSync("sudo systemctl stop minecraft");
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

export async function sendCommand(cmd: string): Promise<{ ok: boolean; error?: string }> {
    if (!isRunning()) return { ok: false, error: "Server is not running" };
    const password = rconPassword();
    if (!password) return { ok: false, error: "MINECRAFT_RCON_PASSWORD is not configured" };

    const client = new RCON();
    try {
        await client.connect(rconHost(), rconPort());
        await client.login(password);
        await client.execute(cmd);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e) };
    } finally {
        try {
            client.close();
        } catch {}
    }
}

async function rconQuery(cmd: string): Promise<string | null> {
    const password = rconPassword();
    if (!password) return null;
    const client = new RCON();
    try {
        await client.connect(rconHost(), rconPort());
        await client.login(password);
        const response = await client.execute(cmd);
        return response;
    } catch {
        return null;
    } finally {
        try {
            client.close();
        } catch {}
    }
}

/** Returns the set of player names currently in the `bots` scoreboard team via RCON.
 *  Falls back to an empty set on any error (e.g. server offline). */
export async function getBotNames(): Promise<Set<string>> {
    const response = await rconQuery("team list bots");
    if (!response) return new Set();
    // MC 1.21 response: "Team bots has N members: Name1, Name2" or "Team bots has 0 members"
    const match = response.match(/members:\s*(.+)$/i);
    if (!match) return new Set();
    return new Set(
        match[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
    );
}

export function getRecentLogs(): string[] {
    const dir = serverDir();
    if (!dir) return [];
    const file = serverLogFile();
    if (!existsSync(file)) return [];
    try {
        const content = readFileSync(file, "utf-8");
        return content.split("\n").filter(Boolean).slice(-200);
    } catch {
        return [];
    }
}

export function getDashboardLogBuffer(): string[] {
    return [...dashboardLogBuffer];
}

// Tails logs/latest.log in real time.
export function subscribeServerLogTail(fn: (event: LogEvent) => void): () => void {
    const dir = serverDir();
    if (!dir) return () => {};

    const file = serverLogFile();
    let cursor = 0;
    let partial = "";

    if (existsSync(file)) {
        try {
            cursor = statSync(file).size;
        } catch {}
    }

    const interval = setInterval(() => {
        try {
            if (!existsSync(file)) {
                cursor = 0;
                partial = "";
                return;
            }

            const size = statSync(file).size;
            if (size < cursor) {
                // File was rotated/truncated.
                cursor = 0;
                partial = "";
                fn({ type: "reset" });
            }
            if (size <= cursor) return;

            const length = size - cursor;
            const fd = openSync(file, "r");
            const chunk = Buffer.alloc(length);
            try {
                const bytesRead = readSync(fd, chunk, 0, length, cursor);
                cursor = size;
                if (bytesRead <= 0) return;

                const text = `${partial}${chunk.toString("utf-8", 0, bytesRead)}`.replace(
                    /\r\n/g,
                    "\n"
                );
                const lines = text.split("\n");
                partial = lines.pop() ?? "";
                for (const line of lines) {
                    if (line) fn({ type: "line", line });
                }
            } finally {
                closeSync(fd);
            }
        } catch {}
    }, 200);

    return () => clearInterval(interval);
}

// Subscribes to in-memory dashboard/update log messages.
export function subscribeDashboardLogs(fn: (event: LogEvent) => void): () => void {
    dashboardListeners.add(fn);
    return () => dashboardListeners.delete(fn);
}

export function updateServer(): { ok: boolean; error?: string } {
    const dir = serverDir();
    if (!dir) return { ok: false, error: "MINECRAFT_SERVER_PATH is not configured" };

    pushDashboardLog("[dashboard] Running azalea server update…");

    const child = spawn("azalea", ["server", "update"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
    });

    const rl = createInterface({ input: child.stdout! });
    rl.on("line", pushDashboardLog);

    const re = createInterface({ input: child.stderr! });
    re.on("line", (l) => pushDashboardLog(`[err] ${l}`));

    child.on("exit", (code) => {
        pushDashboardLog(`[dashboard] Update finished (code ${code ?? "unknown"})`);
    });

    return { ok: true };
}

export function isConfigured(): boolean {
    const dir = serverDir();
    return !!dir && existsSync(configPath());
}

export type AzaleaConfig = {
    source: string;
    pinned_tag: string | null;
    installed_tag: string;
    pack: {
        name: string;
        version: string;
        minecraft_version: string;
        loader: string;
        loader_version: string;
    };
    mods: Record<string, string>;
    run: {
        ram: string;
        java_bin: string;
        jvm_args: string[];
        game_args: string[];
        jar_name: string;
    };
};

export function readConfig(): AzaleaConfig {
    return JSON.parse(readFileSync(configPath(), "utf-8"));
}

export function writeConfig(config: AzaleaConfig): void {
    writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

// Keep for any callers that append directly to the log stream.
export function appendLog(line: string) {
    try {
        appendFileSync(serverLogFile(), `${line}\n`, "utf-8");
    } catch {}
}
