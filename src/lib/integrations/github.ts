/**
 * GitHub organization management client.
 *
 * Auth: a token sent as `Authorization: Bearer <token>`. Use a fine-grained
 * personal access token (or GitHub App installation token) scoped to the single
 * TrickFire organization. Membership management below only needs
 * **Organization → Members: Read and write** - enough to list members, invite
 * people, and remove them. The token deliberately needs no org-administration
 * permission, and this client never grants org-owner ("admin") access:
 * invitations are always sent as `direct_member` and there is no role-promotion
 * call. Configure via GITHUB_TOKEN and GITHUB_ORG.
 *
 * The issue helpers at the bottom (used by the Task Sync tab to mirror Notion
 * tasks) need the token to additionally carry **Repository → Issues: Read and
 * write** on each linked repo.
 *
 * Like the Headscale/Onshape clients, helpers that back the admin page degrade
 * to `null` when the API key is absent or the org is unreachable, so the
 * feature renders a friendly "not configured" state while we wait on the key.
 */

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

export type GithubRole = "admin" | "member";

export type GithubOrg = {
    login: string;
    name: string | null;
    description: string | null;
    htmlUrl: string;
    memberCount: number | null;
};

export type GithubMember = {
    id: number;
    login: string;
    avatarUrl: string;
    htmlUrl: string;
    /** Org role, surfaced read-only - this client never changes it. */
    role: GithubRole;
};

export type GithubInvitation = {
    id: number;
    login: string | null;
    email: string | null;
    role: string;
    createdAt: string | null;
    inviter: string | null;
};

export type GithubTeam = {
    id: number;
    slug: string;
    name: string;
    description: string | null;
};

export type GithubTeamMember = {
    id: number;
    login: string;
    avatarUrl: string;
};

export type GithubIssueState = "open" | "closed";

export type GithubIssue = {
    number: number;
    title: string;
    body: string | null;
    state: GithubIssueState;
    htmlUrl: string;
    updatedAt: string;
};

export function isGithubConfigured(): boolean {
    return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_ORG);
}

/**
 * Raised when GitHub returns a non-2xx response. Carries the API-provided
 * message (GitHub errors are `{ message, ... }`) so callers can surface a
 * meaningful reason rather than a generic failure.
 */
export class GithubError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "GithubError";
        this.status = status;
    }
}

function org(): string | undefined {
    return process.env.GITHUB_ORG;
}

/**
 * Perform a single authenticated request against an absolute GitHub API URL.
 * Returns `null` only when no API key / org is configured. Throws
 * {@link GithubError} on any HTTP error (carrying the GitHub `message`).
 */
async function githubRequest(url: string, options?: RequestInit): Promise<Response | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token || !org()) return null;
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "Content-Type": "application/json",
            ...options?.headers,
        },
        cache: "no-store",
    });
    if (!res.ok) {
        let message = `GitHub request failed (${res.status})`;
        try {
            const parsed = (await res.json()) as { message?: string };
            if (parsed?.message) message = parsed.message;
        } catch {
            // Non-JSON error body; keep the status-based message.
        }
        throw new GithubError(message, res.status);
    }
    return res;
}

/** Request a path relative to the GitHub API base and parse the JSON body. */
async function githubJson<T = unknown>(path: string, options?: RequestInit): Promise<T | null> {
    const res = await githubRequest(`${API_BASE}${path}`, options);
    if (!res) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
}

/** Extract the `rel="next"` URL from a GitHub `Link` response header. */
function parseNextLink(header: string | null): string | null {
    if (!header) return null;
    for (const part of header.split(",")) {
        const match = part.match(/<([^>]+)>;\s*rel="next"/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Fetch every page of a paginated GitHub list endpoint, following the
 * `rel="next"` URL in the Link header until exhausted. The guard caps the
 * number of pages to avoid an unbounded loop on a misbehaving Link chain.
 */
async function githubFetchAll<T>(path: string): Promise<T[] | null> {
    let url: string | null = `${API_BASE}${path}`;
    const items: T[] = [];
    for (let page = 0; url && page < 1000; page++) {
        const res = await githubRequest(url);
        if (!res) return null;
        const batch = (await res.json()) as T[];
        if (Array.isArray(batch)) items.push(...batch);
        url = parseNextLink(res.headers.get("link"));
    }
    return items;
}

// Raw shapes returned by the GitHub REST API (only the fields we use).
type RawUser = { id: number; login: string; avatar_url: string; html_url: string };
type RawInvitation = {
    id: number;
    login: string | null;
    email: string | null;
    role: string;
    created_at: string | null;
    inviter: { login: string } | null;
};
type RawTeam = { id: number; slug: string; name: string; description: string | null };

/**
 * Fetch org metadata. Catches errors and returns `null` so the admin page can
 * render a graceful "not configured / unreachable" state.
 */
export async function getOrg(): Promise<GithubOrg | null> {
    const o = org();
    if (!o) return null;
    try {
        const data = await githubJson<{
            login?: string;
            name?: string | null;
            description?: string | null;
            html_url?: string;
            // GitHub exposes member totals only to org members.
            members_count?: number;
        }>(`/orgs/${o}`);
        if (!data?.login) return null;
        return {
            login: data.login,
            name: data.name ?? null,
            description: data.description ?? null,
            htmlUrl: data.html_url ?? `https://github.com/${data.login}`,
            memberCount: typeof data.members_count === "number" ? data.members_count : null,
        };
    } catch {
        return null;
    }
}

/**
 * List organization members. GitHub does not return each member's role on the
 * list endpoint, so admins are fetched separately and merged in for display.
 * Throws {@link GithubError} on failure (the caller surfaces the message).
 */
export async function getOrgMembers(): Promise<GithubMember[] | null> {
    const o = org();
    if (!o) return null;
    const [all, admins] = await Promise.all([
        githubFetchAll<RawUser>(`/orgs/${o}/members?per_page=100`),
        githubFetchAll<RawUser>(`/orgs/${o}/members?role=admin&per_page=100`),
    ]);
    if (!all) return null;
    const adminIds = new Set((admins ?? []).map((u) => u.id));
    return all.map((u) => ({
        id: u.id,
        login: u.login,
        avatarUrl: u.avatar_url,
        htmlUrl: u.html_url,
        role: adminIds.has(u.id) ? "admin" : "member",
    }));
}

/** Resolve a GitHub username to its numeric user id (used to invite by handle). */
export async function getUserId(username: string): Promise<number> {
    try {
        const user = await githubJson<RawUser>(`/users/${encodeURIComponent(username)}`);
        if (!user?.id) throw new GithubError("GitHub user not found", 404);
        return user.id;
    } catch (err) {
        if (err instanceof GithubError && err.status === 404) {
            throw new GithubError(`GitHub user "${username}" not found`, 404);
        }
        throw err;
    }
}

/**
 * Invite a person to the organization as a regular member. Accepts either a
 * GitHub username or an email address. The role is always `direct_member`:
 * this client never invites owners/admins.
 */
export async function inviteMember(params: { username?: string; email?: string }): Promise<void> {
    const o = org();
    if (!o) throw new GithubError("GitHub organization is not configured", 503);

    const body: Record<string, unknown> = { role: "direct_member" };
    if (params.email) {
        body.email = params.email;
    } else if (params.username) {
        body.invitee_id = await getUserId(params.username);
    } else {
        throw new GithubError("Provide a username or email to invite", 400);
    }

    await githubJson(`/orgs/${o}/invitations`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

/** Remove a member from the org (revokes all team and org access). */
export async function removeMember(username: string): Promise<void> {
    const o = org();
    if (!o) throw new GithubError("GitHub organization is not configured", 503);
    await githubJson(`/orgs/${o}/members/${encodeURIComponent(username)}`, {
        method: "DELETE",
    });
}

/** List pending organization invitations. */
export async function getPendingInvitations(): Promise<GithubInvitation[] | null> {
    const o = org();
    if (!o) return null;
    const items = await githubFetchAll<RawInvitation>(`/orgs/${o}/invitations?per_page=100`);
    if (!items) return null;
    return items.map((i) => ({
        id: i.id,
        login: i.login,
        email: i.email,
        role: i.role,
        createdAt: i.created_at,
        inviter: i.inviter?.login ?? null,
    }));
}

/** Cancel a pending organization invitation. */
export async function cancelInvitation(invitationId: number): Promise<void> {
    const o = org();
    if (!o) throw new GithubError("GitHub organization is not configured", 503);
    await githubJson(`/orgs/${o}/invitations/${invitationId}`, { method: "DELETE" });
}

/** List the organization's teams (read-only). */
export async function getOrgTeams(): Promise<GithubTeam[] | null> {
    const o = org();
    if (!o) return null;
    const items = await githubFetchAll<RawTeam>(`/orgs/${o}/teams?per_page=100`);
    if (!items) return null;
    return items.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description ?? null,
    }));
}

/** List members of a team by slug (read-only). */
export async function getTeamMembers(slug: string): Promise<GithubTeamMember[] | null> {
    const o = org();
    if (!o) return null;
    const items = await githubFetchAll<RawUser>(
        `/orgs/${o}/teams/${encodeURIComponent(slug)}/members?per_page=100`
    );
    if (!items) return null;
    return items.map((u) => ({
        id: u.id,
        login: u.login,
        avatarUrl: u.avatar_url,
    }));
}

type RawIssue = {
    number: number;
    title: string;
    body: string | null;
    state: GithubIssueState;
    html_url: string;
    updated_at: string;
    // Present on issues that are actually pull requests; excluded below since
    // PRs share the issues endpoint but aren't tasks we want to sync.
    pull_request?: unknown;
};

function toIssue(raw: RawIssue): GithubIssue {
    return {
        number: raw.number,
        title: raw.title,
        body: raw.body,
        state: raw.state,
        htmlUrl: raw.html_url,
        updatedAt: raw.updated_at,
    };
}

/** Confirm a repo exists and is reachable with the configured token. */
export async function getRepo(
    owner: string,
    repo: string
): Promise<{ htmlUrl: string; hasIssuesEnabled: boolean } | null> {
    if (!process.env.GITHUB_TOKEN) return null;
    const data = await githubJson<{ html_url?: string; has_issues?: boolean }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );
    if (!data?.html_url) return null;
    return { htmlUrl: data.html_url, hasIssuesEnabled: data.has_issues ?? true };
}

/** List every issue in a repo (open and closed), excluding pull requests. */
export async function getRepoIssues(owner: string, repo: string): Promise<GithubIssue[] | null> {
    if (!process.env.GITHUB_TOKEN) return null;
    const items = await githubFetchAll<RawIssue>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=100`
    );
    if (!items) return null;
    return items.filter((i) => !i.pull_request).map(toIssue);
}

/** Create an issue in a repo. */
export async function createIssue(
    owner: string,
    repo: string,
    params: { title: string; body: string }
): Promise<GithubIssue> {
    if (!process.env.GITHUB_TOKEN) throw new GithubError("GitHub is not configured", 503);
    const data = await githubJson<RawIssue>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        { method: "POST", body: JSON.stringify(params) }
    );
    if (!data) throw new GithubError("GitHub is not configured", 503);
    return toIssue(data);
}

/** Update an issue's title, body, and/or open/closed state. */
export async function updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    params: { title?: string; body?: string; state?: GithubIssueState }
): Promise<GithubIssue> {
    if (!process.env.GITHUB_TOKEN) throw new GithubError("GitHub is not configured", 503);
    const data = await githubJson<RawIssue>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
        { method: "PATCH", body: JSON.stringify(params) }
    );
    if (!data) throw new GithubError("GitHub is not configured", 503);
    return toIssue(data);
}
