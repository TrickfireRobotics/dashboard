/**
 * Notion REST API client, used by the Task Sync tab to mirror a subteam's
 * Notion task database to a GitHub repo (see notion-github-sync.ts).
 *
 * Auth: a token sent as `Authorization: Bearer <token>`. Create an internal
 * integration at https://www.notion.so/my-integrations, share each task
 * database with it, and set NOTION_API_KEY. Like the GitHub/Onshape clients,
 * helpers here degrade to `null` when the key is absent so the feature
 * renders a friendly "not configured" state.
 *
 * Rather than asking an admin to hand-map Notion property names in the UI,
 * every linked database's properties are resolved by *type* (see
 * resolveLinkProperties in notion-github-sync.ts): exactly one `title`
 * property (Notion requires this to exist), exactly one `unique_id` property
 * for the human-readable task key (e.g. "THT-123"), exactly one `status`
 * property for done/not-done, at least one `url` property to write the
 * GitHub issue link back into, and optionally a `rich_text` property used as
 * the issue description.
 *
 * Multiple subteams can share one big database (common at TrickFire - one
 * "Tasks" database for everyone) rather than needing one database per team:
 * each link additionally resolves a property literally named "Team" (see
 * resolveTeamFilterProperty in notion-github-sync.ts) and uses it to filter
 * `queryAllDatabasePages` down to just that team's rows.
 */

const API_BASE = "https://api.notion.com/v1";
const API_VERSION = "2022-06-28";

export function isNotionConfigured(): boolean {
    return Boolean(process.env.NOTION_API_KEY);
}

/**
 * Accept a raw Notion page/database ID, a dashed UUID, or a full notion.so
 * URL (which embeds the ID as a trailing 32-char hex run) and return the
 * dashed UUID form the API expects. Returns `null` if nothing ID-shaped is
 * found.
 */
export function parseNotionDatabaseId(input: string): string | null {
    const match = /[0-9a-f]{32}/i.exec(input.replace(/-/g, ""));
    if (!match) return null;
    const hex = match[0].toLowerCase();
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Raised when Notion returns a non-2xx response. Carries the API-provided
 * message (Notion errors are `{ message, code, ... }`) so callers can surface
 * a meaningful reason rather than a generic failure.
 */
export class NotionError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "NotionError";
        this.status = status;
    }
}

async function notionRequest<T = unknown>(path: string, options?: RequestInit): Promise<T | null> {
    const token = process.env.NOTION_API_KEY;
    if (!token) return null;
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": API_VERSION,
            "Content-Type": "application/json",
            ...options?.headers,
        },
        cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
        let message = `Notion request failed (${res.status})`;
        try {
            const parsed = text ? (JSON.parse(text) as { message?: string }) : null;
            if (parsed?.message) message = parsed.message;
        } catch {
            // Non-JSON error body; keep the status-based message.
        }
        throw new NotionError(message, res.status);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
}

// Raw shapes returned by the Notion API (only the fields we use). Property
// values/defs are typed as flat "every field optional" shapes rather than a
// strict per-type discriminated union: callers resolve a property's type
// once (see resolveLinkProperties in notion-github-sync.ts) and then read its
// matching field directly, so there's nothing to gain from re-narrowing on
// `type` at every read site.
export type RawRichText = { plain_text: string };

/** A page property *value*, as returned when reading a page. */
export type RawPageProperty = {
    id: string;
    type: string;
    title?: RawRichText[];
    unique_id?: { prefix: string | null; number: number };
    status?: { id: string; name: string; color: string } | null;
    rich_text?: RawRichText[];
    url?: string | null;
};

export type RawNotionPage = {
    id: string;
    url: string;
    archived?: boolean;
    in_trash?: boolean;
    last_edited_time: string;
    properties: Record<string, RawPageProperty>;
};

/**
 * A property *definition* in a database's schema (describes the column,
 * e.g. a status property's configured groups/options) - distinct from a
 * page's current property *value* above.
 */
export type RawPropertyDef = {
    id: string;
    type: string;
    unique_id?: { prefix: string | null };
    status?: {
        options: { id: string; name: string }[];
        groups: { id: string; name: string; option_ids: string[] }[];
    };
    select?: { options: { id: string; name: string }[] };
    multi_select?: { options: { id: string; name: string }[] };
    relation?: { database_id: string };
};

export type RawNotionDatabase = {
    id: string;
    title: RawRichText[];
    properties: Record<string, RawPropertyDef>;
};

/** Fetch a database's schema (title + property definitions). */
export async function getDatabase(databaseId: string): Promise<RawNotionDatabase | null> {
    return notionRequest<RawNotionDatabase>(`/databases/${databaseId}`);
}

export type NotionDatabaseSummary = { id: string; title: string };

/**
 * List every database shared with the integration, so the Task Sync "add
 * link" form can offer a picker instead of asking someone to paste an ID.
 */
export async function searchDatabases(): Promise<NotionDatabaseSummary[] | null> {
    if (!process.env.NOTION_API_KEY) return null;

    const databases: NotionDatabaseSummary[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 1000; page++) {
        const data = await notionRequest<{
            results: { id: string; title?: RawRichText[] }[];
            has_more: boolean;
            next_cursor: string | null;
        }>("/search", {
            method: "POST",
            body: JSON.stringify({
                filter: { property: "object", value: "database" },
                page_size: 100,
                ...(cursor ? { start_cursor: cursor } : {}),
            }),
        });
        if (!data) return null;
        for (const r of data.results) {
            databases.push({
                id: r.id,
                title: (r.title ?? []).map((t) => t.plain_text).join("") || "Untitled",
            });
        }
        if (!data.has_more || !data.next_cursor) break;
        cursor = data.next_cursor;
    }
    return databases.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Fetch every page in a database, following `next_cursor` until exhausted.
 * An optional `filter` (Notion's query-filter object) scopes this to the
 * rows for one team when several links share one big database - see
 * resolveTeamFilterProperty in notion-github-sync.ts. Notion excludes
 * archived/trashed pages from query results entirely, so a page that
 * disappears between syncs needs a direct `getPage` lookup (see
 * notion-github-sync.ts) to tell "archived" apart from "never existed".
 */
export async function queryAllDatabasePages(
    databaseId: string,
    filter?: Record<string, unknown>
): Promise<RawNotionPage[] | null> {
    const token = process.env.NOTION_API_KEY;
    if (!token) return null;

    const pages: RawNotionPage[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 1000; page++) {
        const data = await notionRequest<{
            results: RawNotionPage[];
            has_more: boolean;
            next_cursor: string | null;
        }>(`/databases/${databaseId}/query`, {
            method: "POST",
            body: JSON.stringify({
                page_size: 100,
                ...(cursor ? { start_cursor: cursor } : {}),
                ...(filter ? { filter } : {}),
            }),
        });
        if (!data) return null;
        pages.push(...data.results);
        if (!data.has_more || !data.next_cursor) break;
        cursor = data.next_cursor;
    }
    return pages;
}

/**
 * Find a page in a database by its title property, used to resolve a team
 * name to a page id when the "Team" property on a shared task database is a
 * Relation (rather than a Select/Multi-select, which can filter by name
 * directly). Returns `null` if the database isn't configured, has no title
 * property, or no page matches.
 */
export async function findPageIdByTitle(databaseId: string, title: string): Promise<string | null> {
    const database = await getDatabase(databaseId);
    if (!database) return null;
    const titleEntry = Object.entries(database.properties).find(([, p]) => p.type === "title");
    if (!titleEntry) return null;

    const data = await notionRequest<{ results: RawNotionPage[] }>(
        `/databases/${databaseId}/query`,
        {
            method: "POST",
            body: JSON.stringify({
                filter: { property: titleEntry[0], title: { equals: title } },
                page_size: 1,
            }),
        }
    );
    return data?.results[0]?.id ?? null;
}

/** Fetch a single page. Returns `null` only when Notion isn't configured. */
export async function getPage(pageId: string): Promise<RawNotionPage | null> {
    return notionRequest<RawNotionPage>(`/pages/${pageId}`);
}

/** Patch a page's properties, keyed by property name. Returns the updated page. */
export async function updatePageProperties(
    pageId: string,
    properties: Record<string, unknown>
): Promise<RawNotionPage> {
    const page = await notionRequest<RawNotionPage>(`/pages/${pageId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
    });
    if (!page) throw new NotionError("Notion is not configured", 503);
    return page;
}
