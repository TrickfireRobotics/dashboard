import { GitBranch } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { TaskSyncManager } from "@/components/task-sync/TaskSyncManager";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { githubNotionLink, team } from "@/lib/db/schema";
import { isGithubConfigured } from "@/lib/integrations/github";
import { isNotionConfigured } from "@/lib/integrations/notion";

export default async function TaskSyncPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const configured = isNotionConfigured() && isGithubConfigured();

    const teams = configured ? db.select().from(team).orderBy(team.name).all() : [];

    const linkRows = configured
        ? db
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
              .all()
        : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Task Sync</h1>
                <p className="text-muted-foreground text-sm">
                    Mirror a subteam&apos;s Notion task database to a GitHub repo&apos;s issues.
                </p>
            </div>

            {!configured ? (
                <EmptyState
                    icon={GitBranch}
                    title="Task Sync is not configured"
                    description={
                        <>
                            Set <span className="font-mono">NOTION_API_KEY</span>, and{" "}
                            <span className="font-mono">GITHUB_TOKEN</span>/
                            <span className="font-mono">GITHUB_ORG</span> (with repo Issues
                            read/write access), to enable linking.
                        </>
                    }
                />
            ) : (
                <TaskSyncManager
                    teams={teams.map((t) => ({ id: t.id, name: t.name }))}
                    links={linkRows.map((l) => ({
                        ...l,
                        lastSyncedAt: l.lastSyncedAt ? l.lastSyncedAt.toISOString() : null,
                        createdAt: l.createdAt.toISOString(),
                    }))}
                />
            )}
        </div>
    );
}
