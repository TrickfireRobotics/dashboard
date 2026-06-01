"use client";

import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerHead } from "./PlayerHead";

type Entry = {
    uuid: string;
    name: string;
    playTimeSeconds: number;
    isBot: boolean;
    skinSource?: string;
};

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function Rank({ position }: { position: number }) {
    return (
        <span className="text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center text-xs font-medium tabular-nums">
            {position}
        </span>
    );
}

export function PlaytimeLeaderboard() {
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/minecraft/leaderboard", { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setEntries(d as Entry[]))
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, []);

    const top = entries?.slice(0, 10) ?? [];
    const maxTime = top[0]?.playTimeSeconds ?? 1;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Trophy className="text-muted-foreground size-5" />
                    <CardTitle>Playtime Leaderboard</CardTitle>
                </div>
                <CardDescription>Top players by total time on the server.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-10" />
                        ))}
                    </div>
                ) : top.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No playtime data available. Make sure{" "}
                        <code className="text-foreground">MINECRAFT_WORLD_PATH</code> is set.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {top.map((entry, i) => {
                            const pct = Math.round((entry.playTimeSeconds / maxTime) * 100);
                            return (
                                <div key={entry.uuid} className="flex items-center gap-3">
                                    <Rank position={i + 1} />
                                    <PlayerHead
                                        name={entry.name}
                                        skinSource={entry.isBot ? entry.skinSource : undefined}
                                    />
                                    <div className="flex min-w-[9rem] shrink-0 items-center gap-2">
                                        <span className="text-foreground truncate text-sm font-medium">
                                            {entry.name}
                                        </span>
                                        {entry.isBot && (
                                            <Badge variant="secondary" className="shrink-0 text-xs">
                                                Bot
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="bg-muted relative h-2 flex-1 overflow-hidden rounded-full">
                                        <div
                                            className="bg-primary h-full rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className="text-muted-foreground w-16 shrink-0 text-right text-sm tabular-nums">
                                        {formatTime(entry.playTimeSeconds)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
