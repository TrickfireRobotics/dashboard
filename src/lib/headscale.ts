export type HeadscaleNode = {
    id: string;
    machineKey: string;
    nodeKey: string;
    discoKey: string;
    ipAddresses: string[];
    name: string;
    user: { id: string; name: string; createdAt: string };
    lastSeen: string;
    lastSuccessfulUpdate: string;
    expiry: string;
    online: boolean;
    createdAt: string;
    registerMethod: string;
    os: string;
    distro: string;
    distroVersion: string;
};

export type HeadscaleUser = {
    id: string;
    name: string;
    createdAt: string;
};

export type HeadscaleRoute = {
    id: string;
    node: { id: string; name: string };
    prefix: string;
    advertised: boolean;
    enabled: boolean;
    isPrimary: boolean;
    createdAt: string;
    updatedAt: string;
};

export type HeadscaleApiKey = {
    id: string;
    prefix: string;
    expiration: string;
    createdAt: string;
    lastSeen: string | null;
};

async function headscaleFetch(path: string, options?: RequestInit) {
    const base = process.env.HEADSCALE_URL;
    const key = process.env.HEADSCALE_API_KEY;
    if (!base || !key) return null;
    try {
        const res = await fetch(`${base}/api/v1${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
                ...options?.headers,
            },
            cache: "no-store",
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function getHeadscaleNodes(): Promise<{ nodes: HeadscaleNode[] } | null> {
    return headscaleFetch("/node");
}

export async function deleteHeadscaleNode(id: string): Promise<boolean> {
    const res = await headscaleFetch(`/node/${id}`, { method: "DELETE" });
    return res !== null;
}

export async function expireHeadscaleNode(id: string): Promise<boolean> {
    const res = await headscaleFetch(`/node/${id}/expire`, { method: "POST" });
    return res !== null;
}

export async function getHeadscaleUsers(): Promise<{ users: HeadscaleUser[] } | null> {
    return headscaleFetch("/user");
}

export async function getHeadscaleRoutes(): Promise<{ routes: HeadscaleRoute[] } | null> {
    return headscaleFetch("/routes");
}

export async function enableHeadscaleRoute(id: string): Promise<boolean> {
    const res = await headscaleFetch(`/routes/${id}/enable`, { method: "POST" });
    return res !== null;
}

export async function disableHeadscaleRoute(id: string): Promise<boolean> {
    const res = await headscaleFetch(`/routes/${id}/disable`, { method: "POST" });
    return res !== null;
}

export async function getHeadscaleApiKeys(): Promise<{ apiKeys: HeadscaleApiKey[] } | null> {
    return headscaleFetch("/apikey");
}

export async function createHeadscaleApiKey(
    expiration: string
): Promise<{ apiKey: string } | null> {
    return headscaleFetch("/apikey", {
        method: "POST",
        body: JSON.stringify({ expiration }),
    });
}

export async function expireHeadscaleApiKey(prefix: string): Promise<boolean> {
    const res = await headscaleFetch("/apikey/expire", {
        method: "POST",
        body: JSON.stringify({ prefix }),
    });
    return res !== null;
}

export function isHeadscaleConfigured(): boolean {
    return Boolean(process.env.HEADSCALE_URL && process.env.HEADSCALE_API_KEY);
}
