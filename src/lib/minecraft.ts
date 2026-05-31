import { status as queryStatus } from "minecraft-server-util";

export type PlayerSample = { name: string; uuid: string; isBot: boolean; skinSource?: string };

export type ServerStatus = {
    online: boolean;
    playersOnline: number | null;
    playersMax: number | null;
    playerSample: PlayerSample[] | null;
    latencyMs: number | null;
    version: string | null;
    host: string;
    port: number;
    checkedAt: number;
};

const TTL_MS = 30_000;
let cache: { value: ServerStatus; expiresAt: number } | null = null;

function host() {
    return process.env.MINECRAFT_SERVER_HOST ?? "localhost";
}
function port() {
    return Number(process.env.MINECRAFT_SERVER_PORT ?? 25565);
}

function botNames(): { name: string; skin?: string }[] {
    return (process.env.MINECRAFT_BOT_NAMES ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
            const i = entry.indexOf(":");
            if (i === -1) return { name: entry };
            return { name: entry.slice(0, i).trim(), skin: entry.slice(i + 1).trim() || undefined };
        });
}

// In-memory cache resets on server restart; first request after deploy is live.
export async function getServerStatus(): Promise<ServerStatus> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;

    const h = host();
    const p = port();
    const bots = botNames();

    let value: ServerStatus;
    try {
        const res = await queryStatus(h, p, { timeout: 5_000 });

        let botIndex = 0;
        const playerSample: PlayerSample[] =
            res.players.sample?.map((player) => {
                if (player.name === "Anonymous Player" && botIndex < bots.length) {
                    const bot = bots[botIndex++];
                    return { name: bot.name, uuid: player.id, isBot: true, skinSource: bot.skin };
                }
                return { name: player.name, uuid: player.id, isBot: false };
            }) ?? [];

        value = {
            online: true,
            playersOnline: res.players.online,
            playersMax: res.players.max,
            playerSample,
            latencyMs: res.roundTripLatency,
            version: res.version.name,
            host: h,
            port: p,
            checkedAt: Date.now(),
        };
    } catch {
        value = {
            online: false,
            playersOnline: null,
            playersMax: null,
            playerSample: null,
            latencyMs: null,
            version: null,
            host: h,
            port: p,
            checkedAt: Date.now(),
        };
    }

    cache = { value, expiresAt: Date.now() + TTL_MS };
    return value;
}
