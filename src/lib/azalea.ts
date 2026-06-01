import { spawn, type ChildProcess } from "child_process";
import {
    appendFileSync,
    closeSync,
    existsSync,
    openSync,
    readFileSync,
    readSync,
    statSync,
    truncateSync,
    unlinkSync,
    writeFileSync,
} from "fs";
import { createInterface } from "readline";
import * as path from "path";

let proc: ChildProcess | null = null;
const logBuffer: string[] = [];
const MAX_LINES = 500;
type LogEvent = { type: "line"; line: string } | { type: "reset" };
const listeners = new Set<(event: LogEvent) => void>();
export type { LogEvent };

function serverDir() {
    return process.env.MINECRAFT_SERVER_PATH ?? "";
}

function configPath() {
    return path.join(serverDir(), "azalea-server.json");
}

function pidFile() {
    return path.join(serverDir(), ".azalea-dashboard.pid");
}

function dashboardLogFile() {
    return path.join(serverDir(), ".azalea-dashboard.log");
}

function readPidFromFile(): number | null {
    const pf = pidFile();
    if (!existsSync(pf)) return null;
    const pid = parseInt(readFileSync(pf, "utf-8").trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function clearPidFile() {
    const pf = pidFile();
    if (!existsSync(pf)) return;
    try {
        unlinkSync(pf);
    } catch {}
}

function signalProcessTree(pid: number, signal: NodeJS.Signals): boolean {
    try {
        // On Unix, a negative PID targets the entire process group.
        process.kill(-pid, signal);
        return true;
    } catch {}
    try {
        process.kill(pid, signal);
        return true;
    } catch {
        return false;
    }
}

function isProcessTreeAlive(pid: number): boolean {
    try {
        process.kill(-pid, 0);
        return true;
    } catch {}
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function clearLogs() {
    logBuffer.length = 0;
    const dir = serverDir();
    if (dir) {
        const logFile = dashboardLogFile();
        try {
            if (existsSync(logFile)) {
                truncateSync(logFile, 0);
            } else {
                writeFileSync(logFile, "");
            }
        } catch {}
    }
    listeners.forEach((fn) => {
        try {
            fn({ type: "reset" });
        } catch {}
    });
}

function pushLog(line: string) {
    logBuffer.push(line);
    if (logBuffer.length > MAX_LINES) logBuffer.shift();

    const dir = serverDir();
    if (dir) {
        try {
            appendFileSync(dashboardLogFile(), `${line}\n`, "utf-8");
        } catch {}
    }

    listeners.forEach((fn) => {
        try {
            fn({ type: "line", line });
        } catch {}
    });
}

export function isRunning(): boolean {
    if (proc && !proc.killed) {
        try {
            process.kill(proc.pid!, 0);
            return true;
        } catch {}
    }
    const pid = readPidFromFile();
    if (pid && isProcessTreeAlive(pid)) {
        return true;
    }
    clearPidFile();
    return false;
}

export function startServer(): { ok: boolean; error?: string } {
    if (isRunning()) return { ok: false, error: "Server is already running" };
    const dir = serverDir();
    if (!dir) return { ok: false, error: "MINECRAFT_SERVER_PATH is not configured" };

    clearLogs();
    pushLog("[dashboard] Starting server…");

    proc = spawn("azalea", ["server", "run"], {
        cwd: dir,
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
    });

    writeFileSync(pidFile(), String(proc.pid));

    const rl = createInterface({ input: proc.stdout! });
    rl.on("line", pushLog);

    const re = createInterface({ input: proc.stderr! });
    re.on("line", (l) => pushLog(`[err] ${l}`));

    proc.on("exit", (code) => {
        const exitedPid = proc?.pid;
        pushLog(`[dashboard] Server exited (code ${code ?? "unknown"})`);
        proc = null;
        if (exitedPid && !isProcessTreeAlive(exitedPid)) {
            clearPidFile();
        }
    });

    return { ok: true };
}

export function stopServer(): { ok: boolean; error?: string } {
    if (!isRunning()) return { ok: false, error: "Server is not running" };

    pushLog("[dashboard] Sending stop command…");

    if (proc?.stdin) {
        proc.stdin.write("stop\n");

        const targetPid = proc.pid;
        setTimeout(() => {
            if (targetPid && isProcessTreeAlive(targetPid)) {
                pushLog("[dashboard] Server still running; sending SIGINT to process tree…");
                signalProcessTree(targetPid, "SIGINT");
            }
        }, 10_000);

        setTimeout(() => {
            if (targetPid && isProcessTreeAlive(targetPid)) {
                pushLog("[dashboard] Force killing server process tree (SIGTERM)…");
                signalProcessTree(targetPid, "SIGTERM");
            }
        }, 20_000);

        setTimeout(() => {
            if (targetPid && isProcessTreeAlive(targetPid)) {
                pushLog("[dashboard] Force killing server process tree (SIGKILL)…");
                signalProcessTree(targetPid, "SIGKILL");
            }
        }, 30_000);
    } else {
        const pid = readPidFromFile();
        if (!pid) return { ok: false, error: "Server PID not found" };
        if (!signalProcessTree(pid, "SIGTERM")) {
            return { ok: false, error: "Failed to signal server process" };
        }
    }

    return { ok: true };
}

export function sendCommand(cmd: string): { ok: boolean; error?: string } {
    if (!proc?.stdin) {
        return {
            ok: false,
            error: "Commands require the server to be started via this dashboard",
        };
    }
    proc.stdin.write(cmd + "\n");
    pushLog(`> ${cmd}`);
    return { ok: true };
}

export function getLogBuffer(): string[] {
    return [...logBuffer];
}

export function getRecentLogs(): string[] {
    const dir = serverDir();
    if (!dir) return [];
    const logFile = path.join(dir, "logs", "latest.log");
    if (!existsSync(logFile)) return [];
    try {
        const content = readFileSync(logFile, "utf-8");
        return content.split("\n").filter(Boolean).slice(-100);
    } catch {
        return [];
    }
}

export function subscribeLogs(fn: (event: LogEvent) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function hasProcessHandle(): boolean {
    if (!proc?.pid || proc.killed) return false;
    return isProcessTreeAlive(proc.pid);
}

export function getRecentCapturedLogs(): string[] {
    const dir = serverDir();
    if (!dir) return [];
    const logFile = dashboardLogFile();
    if (!existsSync(logFile)) return [];

    try {
        const content = readFileSync(logFile, "utf-8");
        return content.split(/\r?\n/).filter(Boolean).slice(-500);
    } catch {
        return [];
    }
}

export function subscribeCapturedLogTail(fn: (event: LogEvent) => void): () => void {
    const dir = serverDir();
    if (!dir) return () => {};

    const logFile = dashboardLogFile();
    let cursor = 0;
    let partial = "";

    if (existsSync(logFile)) {
        try {
            cursor = statSync(logFile).size;
        } catch {}
    }

    const interval = setInterval(() => {
        try {
            if (!existsSync(logFile)) {
                cursor = 0;
                partial = "";
                return;
            }

            const size = statSync(logFile).size;
            if (size < cursor) {
                cursor = 0;
                partial = "";
                fn({ type: "reset" });
            }
            if (size <= cursor) return;

            const length = size - cursor;
            const fd = openSync(logFile, "r");
            const chunk = Buffer.alloc(length);
            try {
                const bytesRead = readSync(fd, chunk, 0, length, cursor);
                cursor = size;
                if (bytesRead <= 0) return;

                const text = `${partial}${chunk.toString("utf-8", 0, bytesRead)}`.replace(
                    /\r\n/g,
                    "\n",
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

export function isConfigured(): boolean {
    const dir = serverDir();
    return !!dir && existsSync(configPath());
}

export function readConfig(): AzaleaConfig {
    return JSON.parse(readFileSync(configPath(), "utf-8"));
}

export function writeConfig(config: AzaleaConfig): void {
    writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

export function updateServer(): { ok: boolean; error?: string } {
    const dir = serverDir();
    if (!dir) return { ok: false, error: "MINECRAFT_SERVER_PATH is not configured" };

    pushLog("[dashboard] Running azalea server update…");

    const child = spawn("azalea", ["server", "update"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
    });

    const rl = createInterface({ input: child.stdout! });
    rl.on("line", pushLog);

    const re = createInterface({ input: child.stderr! });
    re.on("line", (l) => pushLog(`[err] ${l}`));

    child.on("exit", (code) => {
        pushLog(`[dashboard] Update finished (code ${code ?? "unknown"})`);
    });

    return { ok: true };
}
