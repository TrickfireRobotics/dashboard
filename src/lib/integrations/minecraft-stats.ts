import { readdir, readFile } from "fs/promises";
import path from "path";

import { LRUCache } from "lru-cache";
import { getBotNames } from "./azalea";

export type LeaderboardEntry = {
    uuid: string;
    name: string;
    playTimeSeconds: number;
    isBot: boolean;
};

const nameCache = new LRUCache<string, string>({ max: 500, ttl: 24 * 60 * 60 * 1000 });

let leaderboardCache: { entries: LeaderboardEntry[]; expiresAt: number } | null = null;

async function getPlayerName(uuid: string): Promise<string | null> {
    const cached = nameCache.get(uuid);
    if (cached) return cached;

    try {
        const res = await fetch(
            `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
            { cache: "no-store" }
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { name: string };
        nameCache.set(uuid, data.name);
        return data.name;
    } catch {
        return null;
    }
}

export async function getPlaytimeLeaderboard(): Promise<LeaderboardEntry[]> {
    if (leaderboardCache && leaderboardCache.expiresAt > Date.now()) {
        return leaderboardCache.entries;
    }

    const worldPath = process.env.MINECRAFT_WORLD_PATH;
    if (!worldPath) return [];

    const statsPath = path.join(worldPath, "stats");

    let files: string[];
    try {
        files = await readdir(statsPath);
    } catch {
        return [];
    }

    const [entries, bots] = await Promise.all([collectEntries(statsPath, files), getBotNames()]);

    for (const entry of entries) {
        entry.isBot = bots.has(entry.name);
    }

    const filtered = entries.filter((e) => !e.isBot);
    filtered.sort((a, b) => b.playTimeSeconds - a.playTimeSeconds);
    leaderboardCache = { entries: filtered, expiresAt: Date.now() + 5 * 60 * 1000 };
    return filtered;
}

async function collectEntries(statsPath: string, files: string[]): Promise<LeaderboardEntry[]> {
    const entries: LeaderboardEntry[] = [];

    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const uuid = file.slice(0, -5);

        try {
            const raw = await readFile(path.join(statsPath, file), "utf-8");
            const json = JSON.parse(raw) as {
                stats?: { "minecraft:custom"?: { "minecraft:play_time"?: number } };
            };

            const ticks = json.stats?.["minecraft:custom"]?.["minecraft:play_time"] ?? 0;
            if (ticks <= 0) continue;

            const name = await getPlayerName(uuid);
            if (!name) continue;

            entries.push({
                uuid,
                name,
                playTimeSeconds: Math.floor(ticks / 20),
                isBot: false, // filled in after getBotNames()
            });
        } catch {
            // skip malformed stat files
        }
    }

    return entries;
}
