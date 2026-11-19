/**
 * Two-way sync between a Notion task database and a GitHub repo's issues,
 * driven from the Task Sync tab (one `githubNotionLink` row per subteam).
 * Several subteams can share one database (a single org-wide "Tasks"
 * database is the common case) - each link filters it down to its own team's
 * rows via the database's "Team" property (see resolveTeamFilterProperty).
 *
 * Content (title/description) is authored in Notion and always flows
 * Notion -> GitHub. Completion state flows both ways: closing/reopening the
 * GitHub issue marks the Notion task done/not-done on the next sync, and
 * changing the Notion task's status closes/reopens the issue. If both sides
 * changed since the last sync, Notion wins the tie (see decideSyncAction) -
 * it's the task's source of truth, GitHub is a mirror that a dev workflow
 * also happens to be able to close.
 *
 * `githubNotionTask` rows match a Notion page to a GitHub issue so re-syncs
 * update in place. If that mapping is ever lost (or a sync partially fails
 * before it's written), every created issue's body carries a
 * `<!-- notion-task-id: ... -->` marker so the next sync can re-find it by
 * scanning issue bodies instead of creating a duplicate (see
 * findIssueByMarker).
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { githubNotionLink, githubNotionTask, team } from "@/lib/db/schema";
import {
    createIssue,
    getRepoIssues,
    updateIssue,
    type GithubIssue,
    type GithubIssueState,
} from "./github";
import {
    findPageIdByTitle,
    getDatabase,
    getPage,
    queryAllDatabasePages,
    updatePageProperties,
    type RawNotionDatabase,
    type RawNotionPage,
} from "./notion";

export type ResolvedProperties = {
    titleProp: string;
    taskKeyProp: string;
    statusProp: string;
    doneGroupIds: Set<string>;
    doneOptionId: string;
    notDoneOptionId: string;
    descriptionProp: string | null;
    issueUrlProp: string;
};

/**
 * Resolve which database properties to use by type rather than requiring an
 * admin to hand-map names: exactly one `title` (Notion always has one),
 * exactly one `unique_id` for the task key, exactly one `status` for
 * done/not-done, at least one `url` for the issue-link writeback, and
 * optionally a `rich_text` for the description.
 */
export function resolveLinkProperties(
    database: Pick<RawNotionDatabase, "properties">
): { ok: true; value: ResolvedProperties } | { ok: false; error: string } {
    const entries = Object.entries(database.properties);

    const titleEntry = entries.find(([, p]) => p.type === "title");
    if (!titleEntry) return { ok: false, error: "The database has no title property." };

    const uniqueIdEntries = entries.filter(([, p]) => p.type === "unique_id");
    if (uniqueIdEntries.length !== 1) {
        return {
            ok: false,
            error:
                uniqueIdEntries.length === 0
                    ? `The database needs a unique ID property (Notion's "ID" field type) to use as the task key.`
                    : "The database has more than one unique ID property; only one is supported.",
        };
    }

    const statusEntries = entries.filter(([, p]) => p.type === "status");
    if (statusEntries.length !== 1) {
        return {
            ok: false,
            error:
                statusEntries.length === 0
                    ? "The database needs a Status property to track done/not-done."
                    : "The database has more than one Status property; only one is supported.",
        };
    }
    const [statusName, statusDef] = statusEntries[0];
    const groups = (statusDef.status?.groups ?? []).filter((g) => g.option_ids.length > 0);
    if (groups.length === 0) {
        return { ok: false, error: `Status property "${statusName}" has no options configured.` };
    }
    const doneGroup =
        groups.find((g) => /complete|done/i.test(g.name)) ?? groups[groups.length - 1];
    const notDoneGroup = groups.find((g) => g.id !== doneGroup.id) ?? doneGroup;

    const urlEntries = entries.filter(([, p]) => p.type === "url");
    if (urlEntries.length === 0) {
        return {
            ok: false,
            error: "The database needs a URL property to store the linked GitHub issue.",
        };
    }
    const issueUrlEntry = urlEntries.find(([name]) => /github|issue/i.test(name)) ?? urlEntries[0];

    const richTextEntries = entries.filter(([, p]) => p.type === "rich_text");
    const descriptionEntry =
        richTextEntries.find(([name]) => /description|notes|details/i.test(name)) ??
        richTextEntries[0] ??
        null;

    return {
        ok: true,
        value: {
            titleProp: titleEntry[0],
            taskKeyProp: uniqueIdEntries[0][0],
            statusProp: statusName,
            doneGroupIds: new Set(doneGroup.option_ids),
            doneOptionId: doneGroup.option_ids[0],
            notDoneOptionId: notDoneGroup.option_ids[0],
            descriptionProp: descriptionEntry?.[0] ?? null,
            issueUrlProp: issueUrlEntry[0],
        },
    };
}

export type TeamFilterProperty =
    | { kind: "select"; name: string }
    | { kind: "multi_select"; name: string }
    | { kind: "relation"; name: string; relatedDatabaseId: string };

/**
 * Resolve the property literally named "Team" on a (possibly shared-by-
 * every-subteam) database, used to filter it down to one team's rows. A
 * Select or Multi-select filters by the team name directly; a Relation
 * (pointing at a separate teams database) needs the team's page id, resolved
 * per-sync in buildTeamFilter since it isn't known at schema-resolution time.
 */
export function resolveTeamFilterProperty(
    database: Pick<RawNotionDatabase, "properties">
): { ok: true; value: TeamFilterProperty } | { ok: false; error: string } {
    const entry = Object.entries(database.properties).find(
        ([name]) => name.trim().toLowerCase() === "team"
    );
    if (!entry) {
        return { ok: false, error: `The database needs a property named "Team".` };
    }
    const [name, def] = entry;
    if (def.type === "select" || def.type === "multi_select") {
        return { ok: true, value: { kind: def.type, name } };
    }
    if (def.type === "relation") {
        const relatedDatabaseId = def.relation?.database_id;
        if (!relatedDatabaseId) {
            return { ok: false, error: `The "Team" relation property has no related database.` };
        }
        return { ok: true, value: { kind: "relation", name, relatedDatabaseId } };
    }
    return {
        ok: false,
        error: `The "Team" property must be a Select, Multi-select, or Relation (found "${def.type}").`,
    };
}

/**
 * Build the Notion query filter that scopes a shared database down to one
 * team's rows. Returns `null` only for a Relation property when no page
 * matches `teamName` in the related database - the caller should treat that
 * as a configuration error, not an empty result.
 */
export async function buildTeamFilter(
    prop: TeamFilterProperty,
    teamName: string
): Promise<Record<string, unknown> | null> {
    if (prop.kind === "select") return { property: prop.name, select: { equals: teamName } };
    if (prop.kind === "multi_select") {
        return { property: prop.name, multi_select: { contains: teamName } };
    }
    const pageId = await findPageIdByTitle(prop.relatedDatabaseId, teamName);
    if (!pageId) return null;
    return { property: prop.name, relation: { contains: pageId } };
}

export type NotionTaskSnapshot = {
    pageId: string;
    url: string;
    taskKey: string;
    title: string;
    description: string | null;
    done: boolean;
    issueUrl: string | null;
    lastEditedTime: string;
};

/** Extract the fields we sync from a raw page, using a resolved property map. */
export function extractTaskSnapshot(
    page: RawNotionPage,
    resolved: ResolvedProperties
): NotionTaskSnapshot {
    const props = page.properties;

    const title =
        (props[resolved.titleProp]?.title ?? []).map((t) => t.plain_text).join("") || "(untitled)";

    const uid = props[resolved.taskKeyProp]?.unique_id;
    const taskKey = uid ? `${uid.prefix ? `${uid.prefix}-` : ""}${uid.number}` : page.id;

    const statusOptionId = props[resolved.statusProp]?.status?.id ?? null;
    const done = statusOptionId != null && resolved.doneGroupIds.has(statusOptionId);

    const description = resolved.descriptionProp
        ? (props[resolved.descriptionProp]?.rich_text ?? []).map((t) => t.plain_text).join("")
        : "";

    const issueUrl = props[resolved.issueUrlProp]?.url ?? null;

    return {
        pageId: page.id,
        url: page.url,
        taskKey,
        title,
        description: description || null,
        done,
        issueUrl,
        lastEditedTime: page.last_edited_time,
    };
}

export type SyncAction =
    | { type: "create" }
    | { type: "update_from_notion" }
    | { type: "update_from_github" }
    | { type: "noop" };

/**
 * Decide what a task needs, purely from timestamps - no network/DB access,
 * so this is the core piece covered by unit tests.
 */
export function decideSyncAction(
    notion: Pick<NotionTaskSnapshot, "lastEditedTime" | "done">,
    github: Pick<GithubIssue, "updatedAt" | "state"> | null,
    mapping: { lastNotionEditedTime: string; lastGithubUpdatedAt: string } | null
): SyncAction {
    if (!github) return { type: "create" };

    const notionChanged = !mapping || mapping.lastNotionEditedTime !== notion.lastEditedTime;
    const githubChanged = !mapping || mapping.lastGithubUpdatedAt !== github.updatedAt;

    if (!notionChanged && !githubChanged) return { type: "noop" };
    if (notionChanged) return { type: "update_from_notion" };
    return { type: "update_from_github" };
}

const MARKER_PREFIX = "notion-task-id:";

export function buildIssueBody(
    task: Pick<NotionTaskSnapshot, "description" | "taskKey" | "url" | "pageId">
): string {
    const lines: string[] = [];
    if (task.description) lines.push(task.description, "");
    lines.push("---");
    lines.push(`Synced from Notion task \`${task.taskKey}\`: ${task.url}`);
    lines.push(`<!-- ${MARKER_PREFIX}${task.pageId} -->`);
    return lines.join("\n");
}

/** Recover a task's issue by its embedded marker when the mapping row is missing or stale. */
export function findIssueByMarker(issues: GithubIssue[], pageId: string): GithubIssue | undefined {
    const marker = `<!-- ${MARKER_PREFIX}${pageId} -->`;
    return issues.find((i) => i.body?.includes(marker));
}

export type SyncSummary = {
    created: number;
    updatedFromNotion: number;
    updatedFromGithub: number;
    closed: number;
    skipped: number;
    errors: string[];
};

function emptySummary(): SyncSummary {
    return {
        created: 0,
        updatedFromNotion: 0,
        updatedFromGithub: 0,
        closed: 0,
        skipped: 0,
        errors: [],
    };
}

function upsertMapping(linkId: number, task: NotionTaskSnapshot, issue: GithubIssue): void {
    db.insert(githubNotionTask)
        .values({
            linkId,
            notionPageId: task.pageId,
            notionTaskKey: task.taskKey,
            githubIssueNumber: issue.number,
            lastNotionEditedTime: task.lastEditedTime,
            lastGithubUpdatedAt: issue.updatedAt,
            lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [githubNotionTask.linkId, githubNotionTask.notionPageId],
            set: {
                notionTaskKey: task.taskKey,
                githubIssueNumber: issue.number,
                lastNotionEditedTime: task.lastEditedTime,
                lastGithubUpdatedAt: issue.updatedAt,
                lastSyncedAt: new Date(),
            },
        })
        .run();
}

type LinkRow = typeof githubNotionLink.$inferSelect;

async function applyAction(
    link: LinkRow,
    resolved: ResolvedProperties,
    task: NotionTaskSnapshot,
    issue: GithubIssue | null,
    action: SyncAction,
    summary: SyncSummary
): Promise<void> {
    switch (action.type) {
        case "create": {
            const created = await createIssue(link.githubOwner, link.githubRepo, {
                title: task.title,
                body: buildIssueBody(task),
            });
            const patched = await updatePageProperties(task.pageId, {
                [resolved.issueUrlProp]: { url: created.htmlUrl },
            });
            upsertMapping(link.id, { ...task, lastEditedTime: patched.last_edited_time }, created);
            summary.created++;
            return;
        }
        case "update_from_notion": {
            // decideSyncAction only returns this when an issue was found.
            const current = issue!;
            const desiredState: GithubIssueState = task.done ? "closed" : "open";
            const updated = await updateIssue(link.githubOwner, link.githubRepo, current.number, {
                title: task.title,
                body: buildIssueBody(task),
                state: desiredState,
            });
            upsertMapping(link.id, task, updated);
            summary.updatedFromNotion++;
            return;
        }
        case "update_from_github": {
            // decideSyncAction only returns this when an issue and a prior
            // mapping were both found.
            const current = issue!;
            const patched = await updatePageProperties(task.pageId, {
                [resolved.statusProp]: {
                    status: {
                        id:
                            current.state === "closed"
                                ? resolved.doneOptionId
                                : resolved.notDoneOptionId,
                    },
                },
            });
            upsertMapping(link.id, { ...task, lastEditedTime: patched.last_edited_time }, current);
            summary.updatedFromGithub++;
            return;
        }
        case "noop":
            summary.skipped++;
            return;
    }
}

/**
 * Run one reconciliation pass for a link: fetch everything from both sides,
 * decide+apply an action per task, and record the result on the link row.
 * Errors on individual tasks are collected rather than aborting the whole
 * pass, so one bad task can't block the rest of the team's sync.
 */
export async function syncLink(linkId: number): Promise<SyncSummary> {
    const link = db.select().from(githubNotionLink).where(eq(githubNotionLink.id, linkId)).get();
    if (!link) throw new Error("Link not found");

    const summary = emptySummary();

    try {
        const teamRow = db.select().from(team).where(eq(team.id, link.teamId)).get();
        if (!teamRow) throw new Error("Team not found");

        const database = await getDatabase(link.notionDatabaseId);
        if (!database) throw new Error("Notion is not configured");
        const resolved = resolveLinkProperties(database);
        if (!resolved.ok) throw new Error(resolved.error);

        const teamProp = resolveTeamFilterProperty(database);
        if (!teamProp.ok) throw new Error(teamProp.error);
        const teamFilter = await buildTeamFilter(teamProp.value, teamRow.name);
        if (!teamFilter) {
            throw new Error(
                `Could not find "${teamRow.name}" in the Team property - check the name matches exactly.`
            );
        }

        const rawPages = await queryAllDatabasePages(link.notionDatabaseId, teamFilter);
        if (!rawPages) throw new Error("Notion is not configured");
        const issues = await getRepoIssues(link.githubOwner, link.githubRepo);
        if (!issues) throw new Error("GitHub is not configured");

        const tasks = rawPages
            .filter((p) => !p.archived && !p.in_trash)
            .map((p) => extractTaskSnapshot(p, resolved.value));

        const mappings = db
            .select()
            .from(githubNotionTask)
            .where(eq(githubNotionTask.linkId, linkId))
            .all();
        const mappingByPage = new Map(mappings.map((m) => [m.notionPageId, m]));
        const issueByNumber = new Map(issues.map((i) => [i.number, i]));
        const seenPageIds = new Set<string>();

        for (const task of tasks) {
            seenPageIds.add(task.pageId);
            const mapping = mappingByPage.get(task.pageId) ?? null;
            const issue =
                (mapping && issueByNumber.get(mapping.githubIssueNumber)) ||
                findIssueByMarker(issues, task.pageId) ||
                null;

            try {
                // Self-heal the Notion->GitHub link if a previous pass
                // created the issue but failed before writing the URL back.
                if (issue && task.issueUrl !== issue.htmlUrl) {
                    await updatePageProperties(task.pageId, {
                        [resolved.value.issueUrlProp]: { url: issue.htmlUrl },
                    });
                }
                const action = decideSyncAction(task, issue, mapping);
                await applyAction(link, resolved.value, task, issue, action, summary);
            } catch (err) {
                summary.errors.push(
                    `${task.taskKey}: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        // Pages mapped before but absent from this query are archived or
        // deleted in Notion (both are excluded from query results) - close
        // their issue rather than leaving it open forever. A page reassigned
        // to a different team's Team value also drops out of this query, but
        // getPage() below won't report it as archived, so it's left alone
        // rather than closed (that reassignment should be handled by whoever
        // owns the task re-linking it, not auto-closed here).
        for (const mapping of mappings) {
            if (seenPageIds.has(mapping.notionPageId)) continue;
            try {
                const page = await getPage(mapping.notionPageId);
                const isGone = !page || page.archived || page.in_trash;
                if (!isGone) continue;
                const issue = issueByNumber.get(mapping.githubIssueNumber);
                if (issue && issue.state === "open") {
                    await updateIssue(link.githubOwner, link.githubRepo, issue.number, {
                        state: "closed",
                    });
                    summary.closed++;
                } else {
                    summary.skipped++;
                }
            } catch (err) {
                summary.errors.push(
                    `${mapping.notionTaskKey}: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        db.update(githubNotionLink)
            .set({
                lastSyncedAt: new Date(),
                lastSyncError: summary.errors.length > 0 ? summary.errors.join("; ") : null,
                notionDatabaseName:
                    database.title.map((t) => t.plain_text).join("") || link.notionDatabaseName,
            })
            .where(eq(githubNotionLink.id, linkId))
            .run();
    } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        summary.errors.push(message);
        db.update(githubNotionLink)
            .set({ lastSyncedAt: new Date(), lastSyncError: message })
            .where(eq(githubNotionLink.id, linkId))
            .run();
    }

    return summary;
}
