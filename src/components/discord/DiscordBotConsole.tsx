"use client";

import {
    Activity,
    CheckCircle2,
    HeartPulse,
    Radio,
    ScrollText,
    TriangleAlert,
    Users,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BotActivityEntry, BotLogLine, BotStatus } from "@/lib/integrations/discord-bot";
import { usePoll } from "@/lib/use-poll";

type Snapshot = {
    status: BotStatus | null;
    activity: BotActivityEntry[];
    logs: BotLogLine[];
    loaded: boolean;
};

const initialSnapshot: Snapshot = { status: null, activity: [], logs: [], loaded: false };

function formatTime(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...options,
    }).format(date);
}

function formatDuration(seconds: number) {
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function ConnectionBadge({ connected }: { connected: boolean }) {
    return (
        <Badge variant={connected ? "default" : "destructive"}>
            <span
                className={
                    connected
                        ? "bg-primary-foreground size-1.5 rounded-full"
                        : "bg-destructive size-1.5 rounded-full"
                }
            />
            {connected ? "Connected" : "Disconnected"}
        </Badge>
    );
}

function ConsoleSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                    <Card key={index}>
                        <CardHeader className="gap-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-7 w-32" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-5">
                <Skeleton className="h-96 rounded-xl xl:col-span-3" />
                <Skeleton className="h-96 rounded-xl xl:col-span-2" />
            </div>
        </div>
    );
}

export function DiscordBotConsole() {
    const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);

    const load = useCallback(async () => {
        try {
            const [statusResult, activityResult, logsResult] = await Promise.all([
                fetch("/api/discord-bot/status", { cache: "no-store" }),
                fetch("/api/discord-bot/activity", { cache: "no-store" }),
                fetch("/api/discord-bot/logs", { cache: "no-store" }),
            ]);
            if (!statusResult.ok || !activityResult.ok || !logsResult.ok) return;

            const [status, activity, logs] = (await Promise.all([
                statusResult.json(),
                activityResult.json(),
                logsResult.json(),
            ])) as [BotStatus | null, BotActivityEntry[] | null, BotLogLine[] | null];

            setSnapshot({
                status,
                activity: activity ?? [],
                logs: logs ?? [],
                loaded: true,
            });
        } catch {
            setSnapshot((current) => ({ ...current, loaded: true }));
        }
    }, []);

    usePoll(load, 15_000);

    if (!snapshot.loaded) return <ConsoleSkeleton />;

    const { status, activity, logs } = snapshot;
    if (!status) {
        return (
            <Card className="border-destructive/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TriangleAlert className="text-destructive size-5" />
                        Bot API unavailable
                    </CardTitle>
                    <CardDescription>
                        The dashboard could not read the bot. Check that the bot is running and that
                        DISCORD_BOT_URL and DISCORD_BOT_TOKEN are configured.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const lastWebhook = status.health.lastNotionWebhookAt;
    const lastSync = status.health.lastRoleSyncAt;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <Radio className="size-4" /> Gateway
                        </CardDescription>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                            <ConnectionBadge connected={status.connected} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-xs">
                        up for {formatDuration(status.uptimeSeconds)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <Users className="size-4" /> {status.guild?.name ?? "Guild"}
                        </CardDescription>
                        <CardTitle className="text-2xl tabular-nums">
                            {status.guild?.memberCount ?? "-"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-xs">
                        {status.guild
                            ? `${status.guild.roleCount} roles available`
                            : "Guild not loaded"}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <CheckCircle2 className="size-4" /> Checked in
                        </CardDescription>
                        <CardTitle className="text-2xl tabular-nums">
                            {status.checkedIn.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-xs">
                        Members in the shop now
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <HeartPulse className="size-4" /> Last role sync
                        </CardDescription>
                        <CardTitle className="text-xl">{formatTime(lastSync)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-xs">
                        Notion webhook: {formatTime(lastWebhook)}
                    </CardContent>
                </Card>
            </div>

            {status.health.lastError && (
                <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">
                    <span className="font-medium">Latest bot error:</span> {status.health.lastError}
                    {status.health.lastErrorAt && ` · ${formatTime(status.health.lastErrorAt)}`}
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-5">
                <Card className="xl:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="text-primary size-5" /> Recent activity
                        </CardTitle>
                        <CardDescription>Recorded bot actions, newest first.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activity.length === 0 ? (
                            <p className="text-muted-foreground py-8 text-center text-sm">
                                No activity recorded yet.
                            </p>
                        ) : (
                            <ol className="divide-border divide-y">
                                {activity.map((entry, index) => (
                                    <li
                                        key={`${entry.time}-${index}`}
                                        className="flex gap-3 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                            {entry.kind.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{entry.summary}</p>
                                            {entry.detail && (
                                                <p className="text-muted-foreground mt-0.5 text-xs">
                                                    {entry.detail}
                                                </p>
                                            )}
                                        </div>
                                        <time className="text-muted-foreground shrink-0 pt-0.5 text-xs">
                                            {formatTime(entry.time)}
                                        </time>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="text-primary size-5" /> In the shop
                        </CardTitle>
                        <CardDescription>Currently checked-in members.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {status.checkedIn.length === 0 ? (
                            <p className="text-muted-foreground py-8 text-center text-sm">
                                Nobody is checked in.
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {status.checkedIn.map((member) => (
                                    <li
                                        key={`${member.name}-${member.since}`}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span className="truncate font-medium">{member.name}</span>
                                        <span className="text-muted-foreground shrink-0 text-xs">
                                            since {formatTime(member.since)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ScrollText className="text-primary size-5" /> Bot log tail
                    </CardTitle>
                    <CardDescription>
                        Latest {logs.length} messages, refreshed every 15 seconds.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-background max-h-96 overflow-auto rounded-lg border font-mono text-xs leading-6">
                        {logs.length === 0 ? (
                            <p className="text-muted-foreground p-4">No logs captured yet.</p>
                        ) : (
                            logs.map((line, index) => (
                                <div
                                    key={`${line.time}-${index}`}
                                    className="border-border/60 grid grid-cols-[auto_auto_1fr] gap-x-3 border-b px-3 py-1.5 last:border-b-0"
                                >
                                    <time className="text-muted-foreground">
                                        {formatTime(line.time)}
                                    </time>
                                    <span
                                        className={
                                            line.level === "Error" || line.level === "Critical"
                                                ? "text-destructive"
                                                : line.level === "Warning"
                                                  ? "text-amber-500"
                                                  : "text-primary"
                                        }
                                    >
                                        {line.level}
                                    </span>
                                    <span className="text-foreground/85 min-w-0 break-words">
                                        {line.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
