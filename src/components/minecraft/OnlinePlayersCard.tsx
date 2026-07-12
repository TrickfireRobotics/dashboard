import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerHead } from "./PlayerHead";

type Player = { name: string; uuid: string; isBot: boolean; skinSource?: string };

type Props = {
    status: { online: boolean; playerSample: Player[] | null; botSkinUrl: string | null } | null;
    loading: boolean;
};

export function OnlinePlayersCard({ status, loading }: Props) {
    const players = [...(status?.playerSample ?? [])].sort(
        (a, b) => Number(a.isBot) - Number(b.isBot)
    );
    const botSkinUrl = status?.botSkinUrl ?? undefined;
    const isOnline = status?.online ?? false;

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Online Now</CardTitle>
                <CardDescription>
                    {isOnline
                        ? players.length === 0
                            ? "No players online."
                            : `${players.length} player${players.length === 1 ? "" : "s"} in session.`
                        : "Server is offline."}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
                {loading && !status ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-8" />
                        ))}
                    </div>
                ) : players.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <Users className="text-muted-foreground/50 size-8" />
                        <p className="text-muted-foreground text-sm">Nobody online right now.</p>
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {players.map((p) => (
                            <li key={p.uuid} className="flex items-center gap-2.5 py-0.5">
                                <PlayerHead
                                    name={p.name}
                                    skinSource={p.isBot ? botSkinUrl : undefined}
                                    isSkin={p.isBot && !!botSkinUrl}
                                />
                                {p.isBot && (
                                    <Badge variant="secondary" className="text-xs">
                                        Bot
                                    </Badge>
                                )}
                                <span className="text-foreground text-sm">{p.name}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
