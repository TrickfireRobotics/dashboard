import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { githubNotionLink, team } from "@/lib/db/schema";
import { GithubError, getRepo } from "@/lib/integrations/github";
import { NotionError, getDatabase, parseNotionDatabaseId } from "@/lib/integrations/notion";
import {
    buildTeamFilter,
    resolveLinkProperties,
    resolveTeamFilterProperty,
    syncLink,
} from "@/lib/integrations/notion-github-sync";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const links = db
        .select({
            id: githubNotionLink.id,
            teamId: githubNotionLink.teamId,
            teamName: team.name,
            notionDatabaseId: githubNotionLink.notionDatabaseId,
            notionDatabaseName: githubNotionLink.notionDatabaseName,
            githubOwner: githubNotionLink.githubOwner,
            githubRepo: githubNotionLink.githubRepo,
            lastSyncedAt: githubNotionLink.lastSyncedAt,
            lastSyncError: githubNotionLink.lastSyncError,
            createdAt: githubNotionLink.createdAt,
        })
        .from(githubNotionLink)
        .innerJoin(team, eq(githubNotionLink.teamId, team.id))
        .orderBy(team.name)
        .all();

    return NextResponse.json({ links });
}

// GitHub owner/repo names: letters, digits, hyphens, underscores, and dots
// (repo names additionally allow dots, e.g. "my.repo").
const githubOwner = z
    .string()
    .trim()
    .min(1)
    .max(39)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, "Invalid GitHub owner/org");
const githubRepo = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "Invalid GitHub repository name");

const createLinkSchema = z.object({
    teamId: z.coerce.number().int().positive(),
    notionDatabaseId: z.string().trim().min(1).max(500),
    githubOwner,
    githubRepo,
});

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = createLinkSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const databaseId = parseNotionDatabaseId(parsed.data.notionDatabaseId);
    if (!databaseId) {
        return NextResponse.json(
            { error: "Couldn't find a Notion database ID in that value" },
            { status: 400 }
        );
    }

    const teamRow = db.select().from(team).where(eq(team.id, parsed.data.teamId)).get();
    if (!teamRow) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    try {
        const [database, repo] = await Promise.all([
            getDatabase(databaseId),
            getRepo(parsed.data.githubOwner, parsed.data.githubRepo),
        ]);
        if (!database) {
            return NextResponse.json(
                {
                    error: "Notion is not configured, or the database wasn't found/shared with the integration",
                },
                { status: 404 }
            );
        }
        if (!repo) {
            return NextResponse.json(
                { error: "GitHub is not configured, or the repository wasn't found" },
                { status: 404 }
            );
        }

        const resolved = resolveLinkProperties(database);
        if (!resolved.ok) {
            return NextResponse.json({ error: resolved.error }, { status: 400 });
        }

        const teamProp = resolveTeamFilterProperty(database);
        if (!teamProp.ok) {
            return NextResponse.json({ error: teamProp.error }, { status: 400 });
        }
        const teamFilter = await buildTeamFilter(teamProp.value, teamRow.name);
        if (!teamFilter) {
            return NextResponse.json(
                {
                    error: `Could not find "${teamRow.name}" in the Team property - check the name matches exactly.`,
                },
                { status: 400 }
            );
        }

        const created = db
            .insert(githubNotionLink)
            .values({
                teamId: parsed.data.teamId,
                notionDatabaseId: databaseId,
                notionDatabaseName: database.title.map((t) => t.plain_text).join("") || null,
                githubOwner: parsed.data.githubOwner,
                githubRepo: parsed.data.githubRepo,
                createdBy: user.id,
            })
            .returning()
            .get();

        const summary = await syncLink(created.id);
        return NextResponse.json({ link: created, summary }, { status: 201 });
    } catch (err) {
        if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
            return NextResponse.json(
                { error: "This team is already linked to a repo" },
                { status: 409 }
            );
        }
        const status = err instanceof NotionError || err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to create link";
        return NextResponse.json({ error: message }, { status });
    }
}
