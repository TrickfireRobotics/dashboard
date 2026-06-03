export type NetworkNode = {
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
        if (!res.ok) {
            console.error(`Tailscale API error: ${res.status} ${res.statusText} for ${path}`);
            return null;
        }
        const text = await res.text();
        if (!text) return true;
        return JSON.parse(text);
    } catch (err) {
        console.error(`Tailscale fetch failed for ${path}:`, err);
        return null;
    }
}

function toNode(d: TailscaleDevice): NetworkNode {
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

export async function getNetworkNodes(): Promise<{ nodes: NetworkNode[] } | null> {
    const tailnet = process.env.TAILSCALE_TAILNET || "-";
    const data = await tailscaleFetch(`/tailnet/${tailnet}/devices?fields=all`);
    if (!data || typeof data !== "object") return null;
    const devices: TailscaleDevice[] = (data as { devices: TailscaleDevice[] }).devices ?? [];
    return { nodes: devices.map(toNode) };
}

export async function deleteNetworkNode(id: string): Promise<boolean> {
    const res = await tailscaleFetch(`/device/${id}`, { method: "DELETE" });
    return res !== null;
}

export function isNetworkConfigured(): boolean {
    return Boolean(process.env.TAILSCALE_API_KEY);
}
