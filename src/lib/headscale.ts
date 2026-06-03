// Backed by the Tailscale API. HeadscaleNode is kept as the UI type to
// avoid cascading renames throughout components.

export type HeadscaleNode = {
    id: string;
    ipAddresses: string[];
    name: string;
    user: { name: string };
    lastSeen: string;
    online: boolean;
    os: string;
};

type TailscaleDevice = {
    id: string;
    addresses: string[];
    hostname: string;
    os: string;
    user: string;
    lastSeen: string;
    online: boolean;
};

async function tailscaleFetch(path: string, options?: RequestInit) {
    const key = process.env.TAILSCALE_API_KEY;
    if (!key) return null;
    try {
        const res = await fetch(`https://api.tailscale.com/api/v2${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
                ...options?.headers,
            },
            cache: "no-store",
        });
        if (!res.ok) return null;
        const text = await res.text();
        if (!text) return true;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function toNode(d: TailscaleDevice): HeadscaleNode {
    return {
        id: d.id,
        name: d.hostname,
        ipAddresses: d.addresses ?? [],
        os: d.os ?? "",
        user: { name: d.user ?? "" },
        lastSeen: d.lastSeen,
        online: d.online ?? false,
    };
}

export async function getHeadscaleNodes(): Promise<{ nodes: HeadscaleNode[] } | null> {
    const tailnet = process.env.TAILSCALE_TAILNET ?? "-";
    const data = await tailscaleFetch(`/tailnet/${tailnet}/devices`);
    if (!data || typeof data !== "object") return null;
    const devices: TailscaleDevice[] = (data as { devices: TailscaleDevice[] }).devices ?? [];
    return { nodes: devices.map(toNode) };
}

export async function deleteHeadscaleNode(id: string): Promise<boolean> {
    const res = await tailscaleFetch(`/device/${id}`, { method: "DELETE" });
    return res !== null;
}

export function isHeadscaleConfigured(): boolean {
    return Boolean(process.env.TAILSCALE_API_KEY);
}
