import { Boxes, GitBranch, Users } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { PendingApprovals, type PendingUserRow } from "@/components/admin/PendingApprovals";
import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { AdminGithubManager } from "@/components/github/AdminGithubManager";
import { AdminOnshapeManager } from "@/components/onshape/AdminOnshapeManager";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getOrg, isGithubConfigured } from "@/lib/integrations/github";
import { getOnshapeCompany, isOnshapeConfigured } from "@/lib/integrations/onshape";

const tabTriggerClass =
    "flex-1 gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold shadow-none transition-colors duration-200 data-active:border-transparent data-active:bg-transparent data-active:text-primary-foreground dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-primary-foreground sm:flex-none sm:px-10";

export default async function MembersPage() {
    const current = await getSessionUser();
    if (!current) redirect("/login");

    const pendingRows = db
        .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.approved, false))
        .orderBy(asc(user.createdAt))
        .all();

    const pendingUsers: PendingUserRow[] = pendingRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
    }));

    const memberRows = db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            isActive: user.isActive,
            createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.approved, true))
        .orderBy(asc(user.name))
        .all();

    const members: AdminUserRow[] = memberRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        isActive: u.isActive ?? true,
        createdAt: u.createdAt,
    }));

    const onshapeConfigured = isOnshapeConfigured();
    const onshapeCompany = onshapeConfigured ? await getOnshapeCompany() : null;

    const githubConfigured = isGithubConfigured();
    const githubOrg = githubConfigured ? await getOrg() : null;

    return (
        <div className="space-y-6">
            <Tabs defaultValue="users">
                <TabsList className="bg-muted/50 border-border/60 dark:bg-muted/20 mx-auto h-auto w-full max-w-xl justify-center gap-1.5 rounded-xl border p-2 shadow-sm sm:w-fit">
                    <TabsIndicator className="bg-primary shadow-primary/25 rounded-lg shadow-md" />
                    <TabsTrigger value="users" className={tabTriggerClass}>
                        <Users className="size-4" />
                        Users
                    </TabsTrigger>
                    <TabsTrigger value="onshape" className={tabTriggerClass}>
                        <Boxes className="size-4" />
                        Onshape
                    </TabsTrigger>
                    <TabsTrigger value="github" className={tabTriggerClass}>
                        <GitBranch className="size-4" />
                        GitHub
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-8 pt-6">
                    <PendingApprovals users={pendingUsers} />

                    <UserTable users={members} currentUserId={current.id} />
                </TabsContent>

                <TabsContent value="onshape" className="pt-6">
                    {!onshapeConfigured ? (
                        <EmptyState
                            icon={Boxes}
                            title="Onshape is not configured"
                            description={
                                <>
                                    Set <span className="font-mono">ONSHAPE_ACCESS_KEY</span> and{" "}
                                    <span className="font-mono">ONSHAPE_SECRET_KEY</span> to enable
                                    management.
                                </>
                            }
                        />
                    ) : !onshapeCompany ? (
                        <EmptyState
                            icon={Boxes}
                            title="Couldn't reach the Onshape company"
                            description={
                                <>
                                    Verify the API key has access to a Professional/Enterprise
                                    company and that{" "}
                                    <span className="font-mono">ONSHAPE_COMPANY_ID</span> (if set)
                                    is correct.
                                </>
                            }
                        />
                    ) : (
                        <AdminOnshapeManager company={onshapeCompany} />
                    )}
                </TabsContent>

                <TabsContent value="github" className="pt-6">
                    {!githubConfigured ? (
                        <EmptyState
                            icon={GitBranch}
                            title="GitHub is not configured"
                            description={
                                <>
                                    Set <span className="font-mono">GITHUB_ORG</span> and{" "}
                                    <span className="font-mono">GITHUB_TOKEN</span> to enable
                                    management.
                                </>
                            }
                        />
                    ) : !githubOrg ? (
                        <EmptyState
                            icon={GitBranch}
                            title="Couldn't reach the GitHub organization"
                            description={
                                <>
                                    Verify <span className="font-mono">GITHUB_ORG</span> is correct
                                    and the token has the{" "}
                                    <span className="font-mono">Members: Read and write</span>{" "}
                                    permission for the org.
                                </>
                            }
                        />
                    ) : (
                        <AdminGithubManager org={githubOrg} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
