import { Boxes, LayoutDashboard } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { GithubIcon } from "@/components/icons/brand-icons";
import {
    DashboardMembersManager,
    type DashboardMemberRow,
    type PendingMemberRow,
} from "@/components/team/DashboardMembersManager";
import { AdminGithubManager } from "@/components/github/AdminGithubManager";
import { AdminOnshapeManager } from "@/components/onshape/AdminOnshapeManager";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getOrg, isGithubConfigured } from "@/lib/integrations/github";
import { getOnshapeCompany, isOnshapeConfigured } from "@/lib/integrations/onshape";

// Page-level sections read as underlined tabs, so the segmented controls inside
// each section are unmistakably one level down. after:hidden drops the line
// variant's own underline in favour of the sliding indicator, which is pinned
// to the list's bottom edge so it sits on the divider rather than under it.
const sectionTrigger =
    "h-11 flex-none gap-2 px-1 text-sm font-medium after:hidden data-active:text-foreground";

export default async function MembersPage() {
    const current = await getSessionUser();
    if (!current) redirect("/login");

    const pending: PendingMemberRow[] = db
        .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.approved, false))
        .orderBy(asc(user.createdAt))
        .all();

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

    const members: DashboardMemberRow[] = memberRows.map((u) => ({
        ...u,
        isActive: u.isActive ?? true,
    }));

    const onshapeConfigured = isOnshapeConfigured();
    const onshapeCompany = onshapeConfigured ? await getOnshapeCompany() : null;

    const githubConfigured = isGithubConfigured();
    const githubOrg = githubConfigured ? await getOrg() : null;

    return (
        <Tabs defaultValue="dashboard">
            <TabsList
                variant="line"
                className="border-border h-auto w-full justify-start gap-6 rounded-none border-b p-0"
            >
                <TabsIndicator className="bg-primary top-auto! bottom-[-1px] h-0.5! rounded-none" />
                <TabsTrigger value="dashboard" className={sectionTrigger}>
                    <LayoutDashboard className="size-4" />
                    Dashboard
                </TabsTrigger>
                <TabsTrigger value="onshape" className={sectionTrigger}>
                    <Boxes className="size-4" />
                    Onshape
                </TabsTrigger>
                <TabsTrigger value="github" className={sectionTrigger}>
                    <GithubIcon className="size-4" />
                    GitHub
                </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="pt-6">
                <DashboardMembersManager
                    members={members}
                    pending={pending}
                    currentUserId={current.id}
                />
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
                                Verify the API key has access to a Professional/Enterprise company
                                and that <span className="font-mono">ONSHAPE_COMPANY_ID</span> (if
                                set) is correct.
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
                        icon={GithubIcon}
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
                        icon={GithubIcon}
                        title="Couldn't reach the GitHub organization"
                        description={
                            <>
                                Verify <span className="font-mono">GITHUB_ORG</span> is correct and
                                the token has the{" "}
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
    );
}
