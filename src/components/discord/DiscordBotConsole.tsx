"use client";

import {
    Activity,
    BadgeAlert,
    Check,
    ChevronRight,
    CircleAlert,
    Clock3,
    HeartPulse,
    MessagesSquare,
    Radio,
    ScrollText,
    ShieldCheck,
    TriangleAlert,
    Users,
    Wifi,
    Zap,
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

function formatTime(value: string | null | undefined) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
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

function levelClass(level: string) {
    if (level === "Error" || level === "Critical") return "text-destructive";
    if (level === "Warning") return "text-amber-500";
    return "text-primary";
}

function Signal({ good, label }: { good: boolean; label: string }) {
    return (
        <span className="flex items-center gap-2 text-xs font-medium">
            <span
                className={
                    good
                        ? "size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px] shadow-emerald-500/15"
                        : "bg-destructive shadow-destructive/15 size-2 rounded-full shadow-[0_0_0_4px]"
                }
            />
            {label}
        </span>
    );
}

function ConsoleSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-28" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                    <Skeleton key={index} className="h-32 rounded-xl" />
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-5">
                <Skeleton className="h-96 rounded-xl xl:col-span-3" />
                <Skeleton className="h-96 rounded-xl xl:col-span-2" />
            </div>
        </div>
    );
}

function ActivityIcon({ kind }: { kind: string }) {
    if (kind === "error") return <BadgeAlert className="size-4" />;
    if (kind === "roles_synced") return <ShieldCheck className="size-4" />;
    if (kind === "feedback_received") return <MessagesSquare className="size-4" />;
    return <Activity className="size-4" />;
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

            setSnapshot({ status, activity: activity ?? [], logs: logs ?? [], loaded: true });
        } catch {
            setSnapshot((current) => ({ ...current, loaded: true }));
        }
    }, []);

    usePoll(load, 15_000);

    if (!snapshot.loaded) return <ConsoleSkeleton />;

    const { status, activity, logs } = snapshot;
    if (!status) {
        return (
            <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TriangleAlert className="text-destructive size-5" /> Bot API unavailable
                    </CardTitle>
                    <CardDescription>
                        The dashboard cannot reach the bot. Check the bot service and dashboard
                        token.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const syncReady = Boolean(status.health.lastRoleSyncAt);

    return (
        <div className="space-y-6">
            {status.health.lastError && (
                <section className="border-destructive/30 bg-destructive/8 overflow-hidden rounded-xl border">
                    <div className="flex gap-3 px-4 py-3.5">
                        <span className="bg-destructive/15 text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
                            <CircleAlert className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-destructive text-sm font-semibold">
                                Latest bot error
                            </p>
                            <p className="text-foreground mt-0.5 text-sm">
                                {status.health.lastError}
                            </p>
                        </div>
                        <time className="text-muted-foreground shrink-0 pt-0.5 text-xs">
                            {formatTime(status.health.lastErrorAt)}
                        </time>
                    </div>
                </section>
            )}

            <section className="border-border/70 from-card to-primary/5 relative overflow-hidden rounded-xl border bg-linear-to-br">
                <div className="from-primary/20 pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-radial to-transparent" />
                <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-primary mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
                            <Radio className="size-3.5" /> Live operations
                        </div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-semibold tracking-tight">
                                {status.connected
                                    ? "All systems connected"
                                    : "Gateway disconnected"}
                            </h2>
                            <Badge variant={status.connected ? "default" : "destructive"}>
                                {status.connected ? "Live" : "Offline"}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1.5 text-sm">
                            {status.guild?.name ?? "Discord guild"} · online for{" "}
                            {formatDuration(status.uptimeSeconds)}
                        </p>
                    </div>
                    <div className="border-border/70 bg-background/60 flex items-center gap-3 rounded-lg border px-3 py-2.5 backdrop-blur-sm">
                        <Clock3 className="text-primary size-4" />
                        <div>
                            <p className="text-xs font-medium">Auto-refreshing</p>
                            <p className="text-muted-foreground text-[11px]">Every 15 seconds</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="gap-3 border-emerald-500/20 bg-emerald-500/[0.035]">
                    <CardHeader className="pb-0">
                        <CardDescription className="flex items-center gap-2">
                            <Wifi className="size-4" /> Gateway
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Signal
                            good={status.connected}
                            label={status.connected ? "Connected" : "Disconnected"}
                        />
                        <p className="text-muted-foreground mt-3 text-xs">
                            Uptime {formatDuration(status.uptimeSeconds)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-0">
                        <CardDescription className="flex items-center gap-2">
                            <Zap className="size-4" /> Sync pipeline
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-xs font-medium">
                            <span className="text-primary">Notion</span>
                            <ChevronRight className="text-muted-foreground size-3" />
                            <span className={syncReady ? "text-primary" : "text-muted-foreground"}>
                                Roles
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs">
                            {syncReady
                                ? `Last synced ${formatTime(status.health.lastRoleSyncAt)}`
                                : `Webhook ${formatTime(status.health.lastNotionWebhookAt)}`}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-0">
                        <CardDescription className="flex items-center gap-2">
                            <Users className="size-4" /> Guild
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl leading-none font-semibold tabular-nums">
                            {status.guild?.memberCount ?? "-"}
                        </p>
                        <p className="text-muted-foreground mt-3 text-xs">
                            {status.guild
                                ? `${status.guild.roleCount} roles configured`
                                : "Guild not loaded"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-0">
                        <CardDescription className="flex items-center gap-2">
                            <HeartPulse className="size-4" /> Shop floor
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl leading-none font-semibold tabular-nums">
                            {status.checkedIn.length}
                        </p>
                        <p className="text-muted-foreground mt-3 text-xs">
                            {status.checkedIn.length === 1
                                ? "Member checked in"
                                : "Members checked in"}
                        </p>
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-5">
                <Card className="xl:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="text-primary size-5" /> Activity feed
                        </CardTitle>
                        <CardDescription>Recent actions from Discord and Notion.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activity.length === 0 ? (
                            <p className="text-muted-foreground py-10 text-center text-sm">
                                No activity recorded yet.
                            </p>
                        ) : (
                            <ol className="divide-border divide-y">
                                {activity.map((entry, index) => (
                                    <li
                                        key={`${entry.time}-${index}`}
                                        className="flex gap-3 py-3 first:pt-0 last:pb-0"
                                    >
                                        <span
                                            className={
                                                entry.kind === "error"
                                                    ? "bg-destructive/10 text-destructive mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                                                    : "bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                                            }
                                        >
                                            <ActivityIcon kind={entry.kind} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{entry.summary}</p>
                                            {entry.detail && (
                                                <p className="text-muted-foreground mt-0.5 text-xs">
                                                    {entry.detail}
                                                </p>
                                            )}
                                        </div>
                                        <time className="text-muted-foreground shrink-0 pt-1 text-xs">
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
                        <CardDescription>
                            Live attendance from the check-in message.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {status.checkedIn.length === 0 ? (
                            <div className="text-muted-foreground flex min-h-36 flex-col items-center justify-center gap-2 text-sm">
                                <Check className="text-primary size-5" /> Nobody checked in
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {status.checkedIn.map((member) => (
                                    <li
                                        key={`${member.name}-${member.since}`}
                                        className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm"
                                    >
                                        <span className="truncate font-medium">{member.name}</span>
                                        <span className="text-muted-foreground shrink-0 text-xs">
                                            {formatTime(member.since)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </section>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ScrollText className="text-primary size-5" /> Log tail
                    </CardTitle>
                    <CardDescription>
                        {logs.length} recent messages · refreshed every 15 seconds
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-xs leading-6 text-zinc-300 shadow-inner">
                        {logs.length === 0 ? (
                            <p className="p-4 text-zinc-500">No logs captured yet.</p>
                        ) : (
                            logs.map((line, index) => (
                                <div
                                    key={`${line.time}-${index}`}
                                    className="grid grid-cols-[auto_auto_1fr] gap-x-3 border-b border-zinc-800/80 px-3 py-1.5 last:border-b-0"
                                >
                                    <time className="text-zinc-500">{formatTime(line.time)}</time>
                                    <span className={levelClass(line.level)}>{line.level}</span>
                                    <span className="min-w-0 break-words text-zinc-300">
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
