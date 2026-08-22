import { ChevronDown } from "lucide-react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { WhitelistManager, type AdminWhitelistRow } from "@/components/admin/WhitelistManager";
import { RunSettingsCard } from "@/components/admin/server/RunSettingsCard";
import { ServerConfigEditor } from "@/components/admin/server/ServerConfigEditor";
import { ServerControlCard } from "@/components/admin/server/ServerControlCard";
import { ServerLogViewer } from "@/components/admin/server/ServerLogViewer";
import { Pl3xmapEmbed } from "@/components/minecraft/Pl3xmapEmbed";
import { PlaytimeLeaderboard } from "@/components/minecraft/PlaytimeLeaderboard";
import { ServerStatusSection } from "@/components/minecraft/ServerStatusSection";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { db } from "@/lib/db";
import { minecraftWhitelist, user } from "@/lib/db/schema";
import { isConfigured, isRunning, readConfig } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";

export default async function MinecraftPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const whitelistRows = db
        .select({
            id: minecraftWhitelist.id,
            username: minecraftWhitelist.username,
            status: minecraftWhitelist.status,
            requesterName: user.name,
            requestNote: minecraftWhitelist.requestNote,
            adminNote: minecraftWhitelist.adminNote,
            addedDirectly: minecraftWhitelist.addedDirectly,
            createdAt: minecraftWhitelist.createdAt,
        })
        .from(minecraftWhitelist)
        .leftJoin(user, eq(minecraftWhitelist.userId, user.id))
        .orderBy(
            asc(sql`case when ${minecraftWhitelist.status} = 'pending' then 0 else 1 end`),
            desc(minecraftWhitelist.createdAt)
        )
        .all();

    const whitelistRequests: AdminWhitelistRow[] = whitelistRows.map((r) => ({
        ...r,
        requesterName: r.requesterName ?? null,
    }));

    const serverConfigured = isConfigured();
    const running = isRunning();
    let serverConfig = null;
    let installedTag: string | null = null;
    if (serverConfigured) {
        try {
            serverConfig = readConfig();
            installedTag = serverConfig.installed_tag;
        } catch {}
    }

    return (
        <div className="space-y-6">
            {/*
             * ServerStatusSection uses display:contents so its two child cards
             * (ServerInfoCard, OnlinePlayersCard) become direct grid items,
             * sitting alongside the map as a third column.
             */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <ServerStatusSection />
                <Pl3xmapEmbed />
            </div>

            <PlaytimeLeaderboard />

            <section className="space-y-4">
                <div>
                    <h2>Whitelist</h2>
                    <p className="text-muted-foreground text-sm">
                        Add usernames and manage who can join the server.
                    </p>
                </div>
                <WhitelistManager requests={whitelistRequests} />
            </section>

            <Collapsible className="space-y-4" defaultOpen={false}>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
                    <div>
                        <h2>Server control</h2>
                        <p className="text-muted-foreground text-sm">
                            Start, stop, and configure the Minecraft server via azalea.
                        </p>
                    </div>
                    <ChevronDown className="text-muted-foreground size-5 shrink-0 transition-transform group-data-[panel-open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="flex flex-col gap-6">
                            <ServerControlCard
                                initial={{ running, configured: serverConfigured, installedTag }}
                            />
                            {serverConfig && <RunSettingsCard initial={serverConfig} />}
                            {!serverConfigured && (
                                <div className="border-border text-muted-foreground rounded-lg border p-6 text-center text-sm">
                                    Set <code className="font-mono">MINECRAFT_SERVER_PATH</code> to
                                    enable configuration.
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

                    {serverConfig && <ServerConfigEditor initial={serverConfig} />}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
