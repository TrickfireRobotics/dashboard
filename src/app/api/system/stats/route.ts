import os from "os";

import { currentLoad, fsSize, mem } from "systeminformation";

import { getSessionUser } from "@/lib/session";

export type SystemStats = {
    cpu: { loadPercent: number };
    memory: { usedGb: number; totalGb: number; usedPercent: number };
    disk: { usedGb: number; totalGb: number; usedPercent: number };
    uptime: { seconds: number };
    loadAvg: { one: number; five: number; fifteen: number };
    cachedAt: number;
};

let statsCache: { data: SystemStats; expiresAt: number } | null = null;

export async function GET() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (statsCache && statsCache.expiresAt > Date.now()) {
        return Response.json(statsCache.data);
    }

    try {
        const [load, memory, disks] = await Promise.all([currentLoad(), mem(), fsSize()]);

        const rootDisk = disks.find((d) => d.mount === "/") ?? disks[0];
        const GB = 1024 ** 3;
        const [one, five, fifteen] = os.loadavg();

        const data: SystemStats = {
            cpu: { loadPercent: Math.round(load.currentLoad) },
            memory: {
                usedGb: Math.round(((memory.total - memory.available) / GB) * 10) / 10,
                totalGb: Math.round((memory.total / GB) * 10) / 10,
                usedPercent: Math.round(((memory.total - memory.available) / memory.total) * 100),
            },
            disk: {
                usedGb: Math.round((rootDisk.used / GB) * 10) / 10,
                totalGb: Math.round((rootDisk.size / GB) * 10) / 10,
                usedPercent: Math.round((rootDisk.used / rootDisk.size) * 100),
            },
            uptime: { seconds: Math.floor(os.uptime()) },
            loadAvg: {
                one: Math.round(one * 100) / 100,
                five: Math.round(five * 100) / 100,
                fifteen: Math.round(fifteen * 100) / 100,
            },
            cachedAt: Date.now(),
        };

        statsCache = { data, expiresAt: Date.now() + 5_000 };
        return Response.json(data);
    } catch {
        return Response.json({ error: "stats unavailable" }, { status: 503 });
    }
}
