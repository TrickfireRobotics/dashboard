"use client";

import { Activity, BadgeAlert, ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BotActivityEntry } from "@/lib/integrations/discord-bot";
import { usePoll } from "@/lib/use-poll";

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function FeedIcon({ kind }: { kind: string }) {
    if (kind === "error" || kind === "missing_role") return <BadgeAlert className="size-4" />;
    if (kind === "roles_synced") return <ShieldCheck className="size-4" />;
    return <Activity className="size-4" />;
}

export function DiscordActivityFeed() {
    const [entries, setEntries] = useState<BotActivityEntry[] | null>(null);

    const load = useCallback(async () => {
        try {
            const response = await fetch("/api/discord-bot/activity", { cache: "no-store" });
            if (!response.ok) return;
            setEntries(((await response.json()) as BotActivityEntry[] | null)?.slice(0, 5) ?? []);
        } catch {
            setEntries([]);
        }
    }, []);

    usePoll(load, 30_000);

    return (
        <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h2>Bot activity</h2>
                    <p className="text-muted-foreground text-sm">Recent Discord and Notion work.</p>
                </div>
                <Link
                    href="/discord"
                    className="text-primary flex items-center gap-1 text-sm font-medium"
                >
                    Bot console <ChevronRight className="size-4" />
                </Link>
            </div>
            <Card>
                <CardContent className="pt-4">
                    {entries === null ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, index) => (
                                <Skeleton key={index} className="h-9 w-full" />
                            ))}
                        </div>
                    ) : entries.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                            No bot activity recorded yet.
                        </p>
                    ) : (
                        <ol className="divide-border divide-y">
                            {entries.map((entry, index) => (
                                <li
                                    key={`${entry.time}-${index}`}
                                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    <span
                                        className={
                                            entry.kind === "error" || entry.kind === "missing_role"
                                                ? "bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg"
                                                : "bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
                                        }
                                    >
                                        <FeedIcon kind={entry.kind} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{entry.summary}</p>
                                        {entry.detail && (
                                            <p className="text-muted-foreground truncate text-xs">
                                                {entry.detail}
                                            </p>
                                        )}
                                    </div>
                                    <time className="text-muted-foreground shrink-0 text-xs">
                                        {formatTime(entry.time)}
                                    </time>
                                </li>
                            ))}
                        </ol>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
