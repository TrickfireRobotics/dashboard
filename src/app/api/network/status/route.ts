import { NextResponse } from "next/server";

import { getNetworkNodes, isNetworkConfigured } from "@/lib/integrations/network";
import { getSessionUser } from "@/lib/auth/session";

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

// Tailscale reports a free-form OS string ("linux", "macOS", "iOS", ...).
// Collapse it into the handful of platforms we show as chips.
function platformOf(os: string): string {
    const lower = os.toLowerCase();
    if (lower.includes("mac") || lower.includes("darwin")) return "macOS";
    if (lower.includes("ios")) return "iOS";
    if (lower.includes("android")) return "Android";
    if (lower.includes("windows")) return "Windows";
    if (lower.includes("linux")) return "Linux";
    return "Other";
}

const OFFLINE = { online: false, nodeCount: 0, onlineCount: 0 };

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isNetworkConfigured()) {
        return NextResponse.json({ ...OFFLINE, configured: false });
    }

    const data = await getNetworkNodes();
    if (!data) {
        return NextResponse.json({ ...OFFLINE, configured: true });
    }

    const nodes = data.nodes ?? [];
    const now = Date.now();
    const platforms = new Map<string, number>();
    const owners = new Set<string>();
    let onlineCount = 0;
    let staleCount = 0;
    let lastActivity: number | null = null;

    for (const node of nodes) {
        const platform = platformOf(node.os);
        platforms.set(platform, (platforms.get(platform) ?? 0) + 1);
        if (node.user?.name) owners.add(node.user.name);
        if (node.online) onlineCount++;

        const seen = Date.parse(node.lastSeen);
        if (!Number.isNaN(seen)) {
            if (now - seen > STALE_MS) staleCount++;
            if (lastActivity === null || seen > lastActivity) lastActivity = seen;
        }
    }

    return NextResponse.json({
        online: true,
        configured: true,
        nodeCount: nodes.length,
        onlineCount,
        ownerCount: owners.size,
        staleCount,
        lastActivity: lastActivity === null ? null : new Date(lastActivity).toISOString(),
        tailnet:
            process.env.TAILSCALE_TAILNET && process.env.TAILSCALE_TAILNET !== "-"
                ? process.env.TAILSCALE_TAILNET
                : null,
        platforms: [...platforms.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    });
}
