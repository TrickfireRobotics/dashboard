import { status as queryStatus } from "minecraft-server-util";
import { getBotNames } from "./azalea";

export type PlayerSample = { name: string; uuid: string; isBot: boolean };

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

// In-memory cache resets on server restart; first request after deploy is live.
export async function getServerStatus(): Promise<ServerStatus> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;

    const h = host();
    const p = port();

    let value: ServerStatus;
    try {
        const [res, bots] = await Promise.all([
            queryStatus(h, p, { timeout: 5_000 }),
            getBotNames(),
        ]);

        const playerSample: PlayerSample[] =
            res.players.sample?.map((player) => ({
                name: player.name,
                uuid: player.id,
                isBot: bots.has(player.name),
            })) ?? [];

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
