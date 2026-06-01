/**
 * Onshape REST API client.
 *
 * Auth: HTTP Basic, sending the API access key as the username and the secret
 * key as the password (https://onshape-public.github.io/docs/auth/apikeys/).
 * The base URL defaults to the public cloud; Enterprise accounts can override
 * it with their own subdomain via ONSHAPE_BASE_URL.
 *
 * Plan note: every company/team endpoint below requires the API-key owner to
 * be a member (and, for management, an admin) of an Onshape Professional or
 * Enterprise company. On free/standard plans these endpoints return errors and
 * the helpers below degrade to `null`, like the Headscale client does.
 *
 * Read limitation: Onshape exposes POST/DELETE for global permissions but no
 * GET, so we cannot read a member's current global-permission grants. The
 * API-visible "access" we can report is the company admin flag, guest/light
 * user type, team membership, and the per-team admin flag.
 */

export type OnshapeCompany = {
    id: string;
    name: string;
    admin: boolean;
    ownerId: string | null;
    domainPrefix: string | null;
    type: number | null;
    state: number | null;
};

export type OnshapeMember = {
    /** The underlying Onshape user id — used when removing a member. */
    userId: string | null;
    name: string;
    admin: boolean;
    guest: boolean;
    light: boolean;
    image: string | null;
    dateAdded: string | null;
    lastLoginTime: string | null;
};

export type OnshapeTeam = {
    id: string;
    name: string;
    description: string | null;
};

export type OnshapeTeamMember = {
    userId: string | null;
    name: string;
    admin: boolean;
    image: string | null;
};

export function isOnshapeConfigured(): boolean {
    return Boolean(process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY);
}

/**
 * Raised when Onshape returns a non-2xx response. Carries the API-provided
 * message (Onshape errors are `{ message, status, code, ... }`) so callers can
 * surface a meaningful reason rather than a generic failure.
 */
export class OnshapeError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "OnshapeError";
        this.status = status;
    }
}

function authHeader(): string | null {
    const access = process.env.ONSHAPE_ACCESS_KEY;
    const secret = process.env.ONSHAPE_SECRET_KEY;
    if (!access || !secret) return null;
    return `Basic ${Buffer.from(`${access}:${secret}`).toString("base64")}`;
}

function onshapeBase(): string {
    return process.env.ONSHAPE_BASE_URL || "https://cad.onshape.com/api";
}

/**
 * Perform a single authenticated request against an absolute Onshape URL.
 * Returns `null` only when no API key is configured. Throws {@link OnshapeError}
 * on any HTTP error (carrying the Onshape `message`) and rethrows network
 * failures so callers can distinguish "unavailable" from "empty".
 */
async function onshapeRequest<T = unknown>(url: string, options?: RequestInit): Promise<T | null> {
    const auth = authHeader();
    if (!auth) return null;
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: auth,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...options?.headers,
        },
        cache: "no-store",
    });
    // DELETE and some POSTs return empty bodies.
    const text = await res.text();
    if (!res.ok) {
        let message = `Onshape request failed (${res.status})`;
        try {
            const parsed = text ? (JSON.parse(text) as { message?: string }) : null;
            if (parsed?.message) message = parsed.message;
        } catch {
            // Non-JSON error body; keep the status-based message.
        }
        throw new OnshapeError(message, res.status);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
}

/** Request a path relative to the configured Onshape API base. */
async function onshapeFetch<T = unknown>(path: string, options?: RequestInit): Promise<T | null> {
    return onshapeRequest<T>(`${onshapeBase()}${path}`, options);
}

type OnshapeListPage<T> = { items?: T[]; next?: string | null };

/**
 * Fetch every page of a paginated Onshape list endpoint. Onshape returns a
 * `next` field containing the absolute URL of the following page (null when
 * exhausted); we follow it until there are no more. The guard caps the number
 * of pages to avoid an unbounded loop on a misbehaving `next` chain.
 */
async function onshapeFetchAll<T>(path: string): Promise<T[] | null> {
    let url: string | null = `${onshapeBase()}${path}`;
    const items: T[] = [];
    for (let page = 0; url && page < 1000; page++) {
        const data: OnshapeListPage<T> | null = await onshapeRequest<OnshapeListPage<T>>(url);
        if (!data) return null;
        if (data.items) items.push(...data.items);
        url = data.next ?? null;
    }
    return items;
}

/**
 * Resolve the company id to operate on. Prefers an explicit ONSHAPE_COMPANY_ID;
 * otherwise falls back to the first company the API key owner belongs to.
 * Cached for the lifetime of the server process.
 */
let cachedCompanyId: string | null | undefined;

export async function getOnshapeCompanyId(): Promise<string | null> {
    if (cachedCompanyId !== undefined) return cachedCompanyId;
    const explicit = process.env.ONSHAPE_COMPANY_ID;
    if (explicit) {
        cachedCompanyId = explicit;
        return explicit;
    }
    // Don't cache transient failures: only memoize a definitive answer so a
    // temporary outage doesn't pin the id to null for the process lifetime.
    try {
        const data = await onshapeFetch<{ items?: Array<{ id?: string }> }>("/companies");
        cachedCompanyId = data?.items?.[0]?.id ?? null;
        return cachedCompanyId;
    } catch {
        return null;
    }
}

export async function getOnshapeCompany(): Promise<OnshapeCompany | null> {
    try {
        const cid = await getOnshapeCompanyId();
        if (!cid) return null;
        const c = await onshapeFetch<{
            id?: string;
            name?: string;
            admin?: boolean;
            ownerId?: string;
            domainPrefix?: string;
            type?: number;
            state?: number;
        }>(`/companies/${cid}`);
        if (!c?.id) return null;
        return {
            id: c.id,
            name: c.name ?? "Unknown",
            admin: c.admin ?? false,
            ownerId: c.ownerId ?? null,
            domainPrefix: c.domainPrefix ?? null,
            type: c.type ?? null,
            state: c.state ?? null,
        };
    } catch {
        return null;
    }
}

type RawCompanyUser = {
    admin?: boolean;
    guest?: boolean;
    light?: boolean;
    // Onshape's wire field is `dateAdded_` (trailing underscore), confirmed
    // against the OpenAPI spec / Go client `json` tags.
    dateAdded_?: string;
    lastLoginTime?: string;
    user?: { id?: string; name?: string; image?: string };
    name?: string;
};

export async function getOnshapeMembers(): Promise<OnshapeMember[] | null> {
    const cid = await getOnshapeCompanyId();
    if (!cid) return null;
    const items = await onshapeFetchAll<RawCompanyUser>(`/companies/${cid}/users`);
    if (!items) return null;
    return items.map((m) => ({
        userId: m.user?.id ?? null,
        name: m.user?.name ?? m.name ?? "Unknown",
        admin: m.admin ?? false,
        guest: m.guest ?? false,
        light: m.light ?? false,
        image: m.user?.image ?? null,
        dateAdded: m.dateAdded_ ?? null,
        lastLoginTime: m.lastLoginTime ?? null,
    }));
}

export async function addOnshapeMember(
    email: string,
    opts: { admin?: boolean; guest?: boolean; light?: boolean } = {}
): Promise<void> {
    const cid = await getOnshapeCompanyId();
    if (!cid) throw new OnshapeError("No Onshape company available", 503);
    await onshapeFetch(`/companies/${cid}/users`, {
        method: "POST",
        body: JSON.stringify({
            email,
            admin: opts.admin ?? false,
            guest: opts.guest ?? false,
            light: opts.light ?? false,
        }),
    });
}

export async function removeOnshapeMember(userId: string): Promise<void> {
    const cid = await getOnshapeCompanyId();
    if (!cid) throw new OnshapeError("No Onshape company available", 503);
    await onshapeFetch(`/companies/${cid}/users/${userId}`, {
        method: "DELETE",
    });
}

export async function getOnshapeTeams(): Promise<OnshapeTeam[] | null> {
    const items = await onshapeFetchAll<{ id?: string; name?: string; description?: string }>(
        "/teams"
    );
    if (!items) return null;
    return items
        .filter((t): t is { id: string; name?: string; description?: string } => Boolean(t.id))
        .map((t) => ({
            id: t.id,
            name: t.name ?? "Unnamed team",
            description: t.description ?? null,
        }));
}

export async function getOnshapeTeamMembers(teamId: string): Promise<OnshapeTeamMember[] | null> {
    const items = await onshapeFetchAll<{
        admin?: boolean;
        member?: { id?: string; name?: string; image?: string };
        name?: string;
    }>(`/teams/${teamId}/members`);
    if (!items) return null;
    return items.map((m) => ({
        userId: m.member?.id ?? null,
        name: m.member?.name ?? m.name ?? "Unknown",
        admin: m.admin ?? false,
        image: m.member?.image ?? null,
    }));
}
