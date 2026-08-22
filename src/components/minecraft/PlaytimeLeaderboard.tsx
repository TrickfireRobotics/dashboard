"use client";

import { Clock, Crown, Medal, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

const PODIUM_STYLE = {
    1: {
        icon: Crown,
        wrap: "border-amber-500/40 bg-amber-500/10",
        icon_: "text-amber-400",
        rank: "bg-amber-500 text-amber-950",
        order: "order-2",
        lift: "sm:-translate-y-3",
    },
    2: {
        icon: Medal,
        wrap: "border-slate-400/30 bg-slate-400/10",
        icon_: "text-slate-300",
        rank: "bg-slate-400 text-slate-950",
        order: "order-1",
        lift: "",
    },
    3: {
        icon: Medal,
        wrap: "border-orange-700/40 bg-orange-700/10",
        icon_: "text-orange-500",
        rank: "bg-orange-700 text-orange-50",
        order: "order-3",
        lift: "",
    },
} as const;

function PodiumCard({ entry, position }: { entry: Entry; position: 1 | 2 | 3 }) {
    const style = PODIUM_STYLE[position];
    const Icon = style.icon;

    return (
        <div
            className={cn(
                "relative flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 pt-6 text-center",
                style.wrap,
                style.order,
                style.lift
            )}
        >
            <span
                className={cn(
                    "absolute top-2 left-2 flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
                    style.rank
                )}
            >
                {position}
            </span>
            <Icon className={cn("size-5", style.icon_)} />
            <PlayerHead
                name={entry.name}
                skinSource={entry.isBot ? entry.skinSource : undefined}
                size={44}
                className="rounded-md"
            />
            <div className="flex max-w-full min-w-0 items-center gap-1.5">
                <span className="text-foreground truncate text-sm font-semibold">{entry.name}</span>
                {entry.isBot && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Bot
                    </Badge>
                )}
            </div>
            <span className="text-foreground text-lg font-bold tabular-nums">
                {formatTime(entry.playTimeSeconds)}
            </span>
        </div>
    );
}

function ListRow({ entry, position, pct }: { entry: Entry; position: number; pct: number }) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-muted-foreground w-4 shrink-0 text-center text-xs font-medium tabular-nums">
                {position}
            </span>
            <PlayerHead name={entry.name} skinSource={entry.isBot ? entry.skinSource : undefined} />
            <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                {entry.name}
            </span>
            {entry.isBot && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                    Bot
                </Badge>
            )}
            <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
                {pct}%
            </span>
            <span className="text-foreground w-16 shrink-0 text-right text-sm font-medium tabular-nums">
                {formatTime(entry.playTimeSeconds)}
            </span>
        </div>
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
    const podium = top.slice(0, 3);
    const rest = top.slice(3);
    const maxTime = top[0]?.playTimeSeconds ?? 1;
    const totalSeconds = entries?.reduce((sum, e) => sum + e.playTimeSeconds, 0) ?? 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="text-muted-foreground size-5" />
                        <CardTitle>Playtime Leaderboard</CardTitle>
                    </div>
                    {!loading && totalSeconds > 0 && (
                        <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                            <Clock className="size-3.5" />
                            <span className="tabular-nums">{formatTime(totalSeconds)}</span>
                            <span>tracked</span>
                        </div>
                    )}
                </div>
                <CardDescription>Top players by total time on the server.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-6">
                        <div className="flex items-end gap-3">
                            <Skeleton className="h-32 flex-1 rounded-xl" />
                            <Skeleton className="h-36 flex-1 rounded-xl" />
                            <Skeleton className="h-28 flex-1 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-9" />
                            ))}
                        </div>
                    </div>
                ) : top.length === 0 ? (
                    <EmptyState
                        icon={Trophy}
                        title="No playtime data available"
                        description={
                            <>
                                Make sure{" "}
                                <code className="text-foreground">MINECRAFT_WORLD_PATH</code> is
                                set.
                            </>
                        }
                    />
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-end gap-3">
                            {podium.map((entry, i) => (
                                <PodiumCard
                                    key={entry.uuid}
                                    entry={entry}
                                    position={(i + 1) as 1 | 2 | 3}
                                />
                            ))}
                        </div>
                        {rest.length > 0 && (
                            <div className="divide-border/60 divide-y rounded-lg border">
                                {rest.map((entry, i) => (
                                    <ListRow
                                        key={entry.uuid}
                                        entry={entry}
                                        position={i + 4}
                                        pct={Math.round((entry.playTimeSeconds / maxTime) * 100)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
