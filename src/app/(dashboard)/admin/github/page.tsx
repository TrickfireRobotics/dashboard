import { AdminGithubManager } from "@/components/github/AdminGithubManager";
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
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    GitHub is not configured. Set <span className="font-mono">GITHUB_ORG</span> and{" "}
                    <span className="font-mono">GITHUB_TOKEN</span> to enable management.
                </div>
            ) : !org ? (
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    Couldn&apos;t reach the GitHub organization. Verify{" "}
                    <span className="font-mono">GITHUB_ORG</span> is correct and the token has the{" "}
                    <span className="font-mono">Members: Read and write</span> permission for the
                    org.
                </div>
            ) : (
                <AdminGithubManager org={org} />
            )}
        </div>
    );
}
