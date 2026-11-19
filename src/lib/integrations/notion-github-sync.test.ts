import { describe, expect, it } from "vitest";

import {
    buildIssueBody,
    buildTeamFilter,
    decideSyncAction,
    extractTaskSnapshot,
    findIssueByMarker,
    resolveLinkProperties,
    resolveTeamFilterProperty,
} from "./notion-github-sync";
import type { GithubIssue } from "./github";
import type { RawNotionDatabase, RawNotionPage } from "./notion";

function database(properties: RawNotionDatabase["properties"]): RawNotionDatabase {
    return { id: "db1", title: [{ plain_text: "Tasks" }], properties };
}

function without(
    properties: RawNotionDatabase["properties"],
    key: string
): RawNotionDatabase["properties"] {
    const rest = { ...properties };
    delete rest[key];
    return rest;
}

const baseProperties: RawNotionDatabase["properties"] = {
    Name: { id: "title-id", type: "title" },
    "Task ID": { id: "uid-id", type: "unique_id", unique_id: { prefix: "THT" } },
    Status: {
        id: "status-id",
        type: "status",
        status: {
            options: [
                { id: "todo", name: "To-do" },
                { id: "progress", name: "In Progress" },
                { id: "done", name: "Complete" },
            ],
            groups: [
                { id: "g-todo", name: "To-do", option_ids: ["todo"] },
                { id: "g-progress", name: "In Progress", option_ids: ["progress"] },
                { id: "g-done", name: "Complete", option_ids: ["done"] },
            ],
        },
    },
    "GitHub Issue": { id: "url-id", type: "url" },
    Description: { id: "rt-id", type: "rich_text" },
};

describe("resolveLinkProperties", () => {
    it("resolves a well-formed database", () => {
        const result = resolveLinkProperties(database(baseProperties));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.titleProp).toBe("Name");
        expect(result.value.taskKeyProp).toBe("Task ID");
        expect(result.value.statusProp).toBe("Status");
        expect(result.value.doneOptionId).toBe("done");
        expect(result.value.notDoneOptionId).toBe("todo");
        expect(result.value.doneGroupIds.has("done")).toBe(true);
        expect(result.value.issueUrlProp).toBe("GitHub Issue");
        expect(result.value.descriptionProp).toBe("Description");
    });

    it("rejects a database with no title property", () => {
        const result = resolveLinkProperties(database(without(baseProperties, "Name")));
        expect(result.ok).toBe(false);
    });

    it("rejects a database missing a unique ID property", () => {
        const result = resolveLinkProperties(database(without(baseProperties, "Task ID")));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/unique ID/);
    });

    it("rejects a database with two unique ID properties", () => {
        const result = resolveLinkProperties(
            database({ ...baseProperties, "Other ID": baseProperties["Task ID"] })
        );
        expect(result.ok).toBe(false);
    });

    it("rejects a database missing a status property", () => {
        const result = resolveLinkProperties(database(without(baseProperties, "Status")));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/Status/);
    });

    it("rejects a database with no url property", () => {
        const result = resolveLinkProperties(database(without(baseProperties, "GitHub Issue")));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/URL/);
    });

    it("falls back to the last status group when none is named complete/done", () => {
        const result = resolveLinkProperties(
            database({
                ...baseProperties,
                Status: {
                    id: "status-id",
                    type: "status",
                    status: {
                        options: [
                            { id: "a", name: "Backlog" },
                            { id: "b", name: "Shipped" },
                        ],
                        groups: [
                            { id: "g1", name: "Backlog", option_ids: ["a"] },
                            { id: "g2", name: "Shipped", option_ids: ["b"] },
                        ],
                    },
                },
            })
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.doneOptionId).toBe("b");
    });

    it("works without a description property, leaving it null", () => {
        const result = resolveLinkProperties(database(without(baseProperties, "Description")));
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.descriptionProp).toBeNull();
    });
});

const resolved = (resolveLinkProperties(database(baseProperties)) as { ok: true; value: never })
    .value;

function page(overrides: Partial<RawNotionPage["properties"]> = {}): RawNotionPage {
    return {
        id: "page1",
        url: "https://notion.so/page1",
        last_edited_time: "2026-01-01T00:00:00.000Z",
        properties: {
            Name: { id: "title-id", type: "title", title: [{ plain_text: "Fix the thing" }] },
            "Task ID": {
                id: "uid-id",
                type: "unique_id",
                unique_id: { prefix: "THT", number: 42 },
            },
            Status: {
                id: "status-id",
                type: "status",
                status: { id: "todo", name: "To-do", color: "gray" },
            },
            "GitHub Issue": { id: "url-id", type: "url", url: null },
            Description: {
                id: "rt-id",
                type: "rich_text",
                rich_text: [{ plain_text: "Some details" }],
            },
            ...overrides,
        },
    };
}

describe("extractTaskSnapshot", () => {
    it("extracts title, task key, description, and issue url", () => {
        const snap = extractTaskSnapshot(page(), resolved);
        expect(snap.title).toBe("Fix the thing");
        expect(snap.taskKey).toBe("THT-42");
        expect(snap.description).toBe("Some details");
        expect(snap.done).toBe(false);
        expect(snap.issueUrl).toBeNull();
    });

    it("marks a task done when its status is in the done group", () => {
        const snap = extractTaskSnapshot(
            page({
                Status: {
                    id: "status-id",
                    type: "status",
                    status: { id: "done", name: "Complete", color: "green" },
                },
            }),
            resolved
        );
        expect(snap.done).toBe(true);
    });

    it("falls back to the page id as the task key when the property is missing", () => {
        const snap = extractTaskSnapshot(
            page({ "Task ID": { id: "uid-id", type: "unique_id" } }),
            resolved
        );
        expect(snap.taskKey).toBe("page1");
    });
});

const mapping = { lastNotionEditedTime: "t1", lastGithubUpdatedAt: "g1" };
const issue = { updatedAt: "g1", state: "open" as const };

describe("decideSyncAction", () => {
    it("creates an issue when none exists yet", () => {
        expect(decideSyncAction({ lastEditedTime: "t1", done: false }, null, null)).toEqual({
            type: "create",
        });
    });

    it("does nothing when neither side changed", () => {
        expect(decideSyncAction({ lastEditedTime: "t1", done: false }, issue, mapping)).toEqual({
            type: "noop",
        });
    });

    it("pushes to GitHub when only the Notion task changed", () => {
        expect(decideSyncAction({ lastEditedTime: "t2", done: false }, issue, mapping)).toEqual({
            type: "update_from_notion",
        });
    });

    it("pulls from GitHub when only the issue changed", () => {
        expect(
            decideSyncAction(
                { lastEditedTime: "t1", done: false },
                { ...issue, updatedAt: "g2" },
                mapping
            )
        ).toEqual({ type: "update_from_github" });
    });

    it("prefers Notion when both sides changed since the last sync", () => {
        expect(
            decideSyncAction(
                { lastEditedTime: "t2", done: false },
                { ...issue, updatedAt: "g2" },
                mapping
            )
        ).toEqual({ type: "update_from_notion" });
    });
});

describe("resolveTeamFilterProperty", () => {
    it("resolves a Select 'Team' property", () => {
        const result = resolveTeamFilterProperty(
            database({ ...baseProperties, Team: { id: "team-id", type: "select" } })
        );
        expect(result).toEqual({ ok: true, value: { kind: "select", name: "Team" } });
    });

    it("resolves a Multi-select 'Team' property", () => {
        const result = resolveTeamFilterProperty(
            database({ ...baseProperties, Team: { id: "team-id", type: "multi_select" } })
        );
        expect(result).toEqual({ ok: true, value: { kind: "multi_select", name: "Team" } });
    });

    it("resolves a Relation 'Team' property", () => {
        const result = resolveTeamFilterProperty(
            database({
                ...baseProperties,
                Team: { id: "team-id", type: "relation", relation: { database_id: "teams-db" } },
            })
        );
        expect(result).toEqual({
            ok: true,
            value: { kind: "relation", name: "Team", relatedDatabaseId: "teams-db" },
        });
    });

    it("matches the property name case-insensitively", () => {
        const result = resolveTeamFilterProperty(
            database({ ...baseProperties, team: { id: "team-id", type: "select" } })
        );
        expect(result.ok).toBe(true);
    });

    it("rejects a database with no Team property", () => {
        const result = resolveTeamFilterProperty(database(baseProperties));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/Team/);
    });

    it("rejects a Team property of an unsupported type", () => {
        const result = resolveTeamFilterProperty(
            database({ ...baseProperties, Team: { id: "team-id", type: "people" } })
        );
        expect(result.ok).toBe(false);
    });
});

describe("buildTeamFilter", () => {
    it("builds a select filter", async () => {
        const filter = await buildTeamFilter({ kind: "select", name: "Team" }, "Arm");
        expect(filter).toEqual({ property: "Team", select: { equals: "Arm" } });
    });

    it("builds a multi_select filter", async () => {
        const filter = await buildTeamFilter({ kind: "multi_select", name: "Team" }, "Arm");
        expect(filter).toEqual({ property: "Team", multi_select: { contains: "Arm" } });
    });

    it("returns null for a relation when the team page can't be resolved (no Notion config in tests)", async () => {
        const filter = await buildTeamFilter(
            { kind: "relation", name: "Team", relatedDatabaseId: "teams-db" },
            "Arm"
        );
        expect(filter).toBeNull();
    });
});

describe("buildIssueBody / findIssueByMarker", () => {
    it("embeds a marker that round-trips through findIssueByMarker", () => {
        const task = {
            description: "desc",
            taskKey: "THT-42",
            url: "https://notion.so/page1",
            pageId: "page1",
        };
        const body = buildIssueBody(task);
        expect(body).toContain("THT-42");
        expect(body).toContain("desc");

        const issues: GithubIssue[] = [
            { number: 1, title: "x", body: "unrelated", state: "open", htmlUrl: "", updatedAt: "" },
            { number: 2, title: "y", body, state: "open", htmlUrl: "", updatedAt: "" },
        ];
        expect(findIssueByMarker(issues, "page1")?.number).toBe(2);
        expect(findIssueByMarker(issues, "missing")).toBeUndefined();
    });
});
