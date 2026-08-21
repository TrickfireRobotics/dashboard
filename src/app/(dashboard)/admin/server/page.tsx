import { redirect } from "next/navigation";

import { RunSettingsCard } from "@/components/admin/server/RunSettingsCard";
import { ServerConfigEditor } from "@/components/admin/server/ServerConfigEditor";
import { ServerControlCard } from "@/components/admin/server/ServerControlCard";
import { ServerLogViewer } from "@/components/admin/server/ServerLogViewer";
import { isConfigured, isRunning, readConfig } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export default async function AdminServerPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const configured = isConfigured();
    const running = isRunning();

    let config = null;
    let installedTag: string | null = null;
    if (configured) {
        try {
            config = readConfig();
            installedTag = config.installed_tag;
        } catch {}
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Server</h1>
                <p className="text-muted-foreground">Manage the Minecraft server via azalea.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6">
                    <ServerControlCard initial={{ running, configured, installedTag }} />
                    {config && <RunSettingsCard initial={config} />}
                    {!configured && (
                        <div className="border-border text-muted-foreground rounded-lg border p-6 text-center text-sm">
                            Set <code className="font-mono">MINECRAFT_SERVER_PATH</code> to enable
                            configuration.
                        </div>
                    )}
                </div>
                {/* relative+self-stretch makes this column stretch to the left column's height.
                    The inner absolute div fills that height without contributing to row sizing,
                    so the grid row height is driven only by the left column. */}
                <div className="lg:relative lg:col-span-2 lg:self-stretch">
                    <div className="flex min-h-96 flex-col lg:absolute lg:inset-0">
                        <ServerLogViewer />
                    </div>
                </div>
            </div>

            {config && <ServerConfigEditor initial={config} />}
        </div>
    );
}
