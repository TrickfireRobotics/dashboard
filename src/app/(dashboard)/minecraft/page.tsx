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
import { WhitelistRequestForm } from "@/components/minecraft/WhitelistRequestForm";
import { WhitelistStatusBadge } from "@/components/minecraft/WhitelistStatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { db } from "@/lib/db";
import { minecraftWhitelist, user } from "@/lib/db/schema";
import { isConfigured, isRunning, readConfig } from "@/lib/integrations/azalea";
import { getSessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";

export default async function MinecraftPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const requests = db
        .select({
            id: minecraftWhitelist.id,
            username: minecraftWhitelist.username,
            status: minecraftWhitelist.status,
            adminNote: minecraftWhitelist.adminNote,
            createdAt: minecraftWhitelist.createdAt,
        })
        .from(minecraftWhitelist)
        .where(eq(minecraftWhitelist.userId, sessionUser.id))
        .orderBy(desc(minecraftWhitelist.createdAt))
        .all();

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
            <div>
                <h1 className="text-3xl">Minecraft</h1>
                <p className="text-muted-foreground">Club server status and whitelist requests.</p>
            </div>

            {/*
             * ServerStatusSection uses display:contents so its two child cards
             * (ServerInfoCard, OnlinePlayersCard) become direct grid items,
             * giving us 3 equal columns with a single shared fetch.
             */}
            <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
                <ServerStatusSection />

                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Whitelist</CardTitle>
                        <CardDescription>Request access to the club server.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <WhitelistRequestForm />

                        {requests.length > 0 && (
                            <div className="h-full space-y-1">
                                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                    Your Requests
                                </p>
                                <ul className="divide-border divide-y">
                                    {requests.map((r) => (
                                        <li
                                            key={r.id}
                                            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-foreground truncate text-sm font-medium">
                                                    {r.username}
                                                </p>
                                                <p className="text-muted-foreground truncate text-xs">
                                                    {formatDate(r.createdAt)}
                                                    {r.adminNote ? ` · ${r.adminNote}` : ""}
                                                </p>
                                            </div>
                                            <WhitelistStatusBadge status={r.status} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <PlaytimeLeaderboard />

            <Pl3xmapEmbed />

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Whitelist management</h2>
                    <p className="text-muted-foreground text-sm">
                        Review whitelist requests and add usernames directly.
                    </p>
                </div>
                <WhitelistManager requests={whitelistRequests} />
            </section>

            <Collapsible className="space-y-4" defaultOpen={false}>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
                    <div>
                        <h2 className="text-lg font-semibold">Server control</h2>
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
