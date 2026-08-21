import { GitBranch } from "lucide-react";

import { AdminGithubManager } from "@/components/github/AdminGithubManager";
import { EmptyState } from "@/components/ui/empty-state";
import { getOrg, isGithubConfigured } from "@/lib/integrations/github";

export default async function AdminGithubPage() {
    const configured = isGithubConfigured();
    const org = configured ? await getOrg() : null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">GitHub</h1>
                <p className="text-muted-foreground">
                    Manage TrickFire organization members, invitations, and teams.
                </p>
            </div>

            {!configured ? (
                <EmptyState
                    icon={GitBranch}
                    title="GitHub is not configured"
                    description={
                        <>
                            Set <span className="font-mono">GITHUB_ORG</span> and{" "}
                            <span className="font-mono">GITHUB_TOKEN</span> to enable management.
                        </>
                    }
                />
            ) : !org ? (
                <EmptyState
                    icon={GitBranch}
                    title="Couldn't reach the GitHub organization"
                    description={
                        <>
                            Verify <span className="font-mono">GITHUB_ORG</span> is correct and the
                            token has the <span className="font-mono">Members: Read and write</span>{" "}
                            permission for the org.
                        </>
                    }
                />
            ) : (
                <AdminGithubManager org={org} />
            )}
        </div>
    );
}
