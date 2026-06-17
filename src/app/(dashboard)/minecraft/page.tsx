import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { Pl3xmapEmbed } from "@/components/minecraft/Pl3xmapEmbed";
import { PlaytimeLeaderboard } from "@/components/minecraft/PlaytimeLeaderboard";
import { ServerStatusSection } from "@/components/minecraft/ServerStatusSection";
import { WhitelistRequestForm } from "@/components/minecraft/WhitelistRequestForm";
import { WhitelistStatusBadge } from "@/components/minecraft/WhitelistStatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";

export default async function MinecraftPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const requests = db
        .select({
            id: minecraftWhitelist.id,
            username: minecraftWhitelist.username,
            status: minecraftWhitelist.status,
            adminNote: minecraftWhitelist.adminNote,
            createdAt: minecraftWhitelist.createdAt,
        })
        .from(minecraftWhitelist)
        .where(eq(minecraftWhitelist.userId, user.id))
        .orderBy(desc(minecraftWhitelist.createdAt))
        .all();

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
        </div>
    );
}
