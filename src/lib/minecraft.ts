import { status as queryStatus } from "minecraft-server-util";

export type ServerStatus = {
  online: boolean;
  playersOnline: number | null;
  playersMax: number | null;
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
    const res = await queryStatus(h, p, { timeout: 5_000 });
    value = {
      online: true,
      playersOnline: res.players.online,
      playersMax: res.players.max,
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
