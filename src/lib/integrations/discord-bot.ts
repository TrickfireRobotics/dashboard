export type BotActivityEntry = {
    time: string;
    kind: string;
    summary: string;
    detail: string | null;
};

export type BotLogLine = {
    time: string;
    level: string;
    category: string;
    message: string;
};

export type BotStatus = {
    connected: boolean;
    startedAt: string;
    uptimeSeconds: number;
    guild: { name: string; memberCount: number; roleCount: number } | null;
    checkedIn: { name: string; since: string }[];
    health: {
        lastNotionWebhookAt: string | null;
        lastRoleSyncAt: string | null;
        lastErrorAt: string | null;
        lastError: string | null;
    };
};

export function isConfigured(): boolean {
    return Boolean(process.env.DISCORD_BOT_URL && process.env.DISCORD_BOT_TOKEN);
}

async function botFetch<T>(path: string): Promise<T | null> {
    const base = process.env.DISCORD_BOT_URL;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!base || !token) return null;

    try {
        const res = await fetch(`${base}${path}`, {
            headers: { "X-Dashboard-Token": token },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
            console.error(`Discord bot API error: ${res.status} ${res.statusText} for ${path}`);
            return null;
        }
        return (await res.json()) as T;
    } catch (err) {
        console.error(`Discord bot fetch failed for ${path}:`, err);
        return null;
    }
}

export async function clearBotError(): Promise<boolean> {
    const base = process.env.DISCORD_BOT_URL;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!base || !token) return false;

    try {
        const res = await fetch(`${base}/api/errors/clear`, {
            method: "POST",
            headers: { "X-Dashboard-Token": token },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
            console.error(`Discord bot API error: ${res.status} ${res.statusText} clearing error`);
        }
        return res.ok;
    } catch (err) {
        console.error("Discord bot error clear failed:", err);
        return false;
    }
}

export function getBotStatus() {
    return botFetch<BotStatus>("/api/status");
}

export function getBotActivity(limit = 50) {
    return botFetch<BotActivityEntry[]>(`/api/activity?limit=${limit}`);
}

export function getBotLogs(limit = 200) {
    return botFetch<BotLogLine[]>(`/api/logs?limit=${limit}`);
}
