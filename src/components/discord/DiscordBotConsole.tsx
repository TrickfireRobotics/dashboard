"use client";

import {
    Activity,
    BadgeAlert,
    Check,
    ChevronRight,
    CircleAlert,
    ChevronDown,
    HeartPulse,
    MessagesSquare,
    ScrollText,
    ShieldCheck,
    TriangleAlert,
    Users,
    Wifi,
    X,
    Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    if (kind === "error" || kind === "missing_role") return <BadgeAlert className="size-4" />;
    if (kind === "roles_synced") return <ShieldCheck className="size-4" />;
    if (kind === "feedback_received") return <MessagesSquare className="size-4" />;
    return <Activity className="size-4" />;
}

export function DiscordBotConsole() {
    const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
    const [clearingError, setClearingError] = useState(false);

    const load = useCallback(async () => {
        try {
            const [statusResult, activityResult, logsResult] = await Promise.all([
                fetch("/api/discord-bot/status", { cache: "no-store" }),
                fetch("/api/discord-bot/activity?limit=500", { cache: "no-store" }),
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
    const missingRoles = status.missingRoles;
    const health = !status.connected
        ? {
              label: "Discord offline",
              detail: "The Discord gateway is disconnected.",
              className: "border-destructive/30 bg-destructive/8 text-destructive",
              dotClassName: "bg-destructive shadow-destructive/25",
          }
        : status.health.lastError || missingRoles.length > 0 || !syncReady
          ? {
                label: "Needs attention",
                detail: status.health.lastError
                    ? "The bot is online, but a recent operation failed."
                    : missingRoles.length > 0
                      ? `${missingRoles.length} Discord role${missingRoles.length === 1 ? " is" : "s are"} missing.`
                      : "Discord is online. Waiting for the first successful Notion role sync.",
                className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                dotClassName: "bg-amber-500 shadow-amber-500/25",
            }
          : {
                label: "Bot online",
                detail: `${status.guild?.name ?? "Discord"} is connected and Notion role sync is healthy.`,
                className:
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                dotClassName: "bg-emerald-500 shadow-emerald-500/25",
            };

    async function dismissError() {
        setClearingError(true);
        try {
            const response = await fetch("/api/discord-bot/errors/clear", { method: "POST" });
            if (!response.ok) return;

            setSnapshot((current) => {
                if (!current.status) return current;
                return {
                    ...current,
                    status: {
                        ...current.status,
                        health: {
                            ...current.status.health,
                            lastError: null,
                            lastErrorAt: null,
                        },
                    },
                };
            });
        } finally {
            setClearingError(false);
        }
    }

    function activityRow(entry: BotActivityEntry, index: number) {
        const isError = entry.kind === "error";
        const isMissingRole = entry.kind === "missing_role";

        return (
            <li key={`${entry.time}-${index}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span
                    className={
                        isError
                            ? "bg-destructive/10 text-destructive mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                            : isMissingRole
                              ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                    }
                >
                    <ActivityIcon kind={entry.kind} />
                </span>
                <div className="min-w-0 flex-1">
                    <p
                        className={
                            isMissingRole
                                ? "text-sm font-medium text-amber-700 dark:text-amber-300"
                                : "text-sm font-medium"
                        }
                    >
                        {entry.summary}
                    </p>
                    {entry.detail && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{entry.detail}</p>
                    )}
                </div>
                <time className="text-muted-foreground shrink-0 pt-1 text-xs">
                    {formatTime(entry.time)}
                </time>
            </li>
        );
    }

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
                        <button
                            type="button"
                            onClick={dismissError}
                            disabled={clearingError}
                            aria-label="Dismiss latest bot error"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring flex size-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-50"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </section>
            )}

            <section
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${health.className}`}
            >
                <span
                    className={`size-2.5 shrink-0 rounded-full shadow-[0_0_0_5px] ${health.dotClassName}`}
                />
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{health.label}</p>
                    <p className="text-foreground/70 mt-0.5 text-sm">{health.detail}</p>
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
                                {activity.slice(0, 15).map(activityRow)}
                            </ol>
                        )}
                        {activity.length > 15 && (
                            <Dialog>
                                <DialogTrigger
                                    render={
                                        <button
                                            type="button"
                                            className="text-primary hover:bg-primary/5 mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm font-medium transition-colors"
                                        />
                                    }
                                >
                                    View all {activity.length} activity entries
                                    <ChevronDown className="size-4" />
                                </DialogTrigger>
                                <DialogContent
                                    className="max-w-3xl p-0"
                                    overlayClassName="bg-black/35 backdrop-blur-sm"
                                >
                                    <DialogHeader className="border-b px-6 py-5 pr-12">
                                        <DialogTitle>Full bot activity</DialogTitle>
                                        <DialogDescription>
                                            Every recorded Discord and Notion action, newest first.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[70vh] overflow-y-auto px-6 py-2">
                                        <ol className="divide-border divide-y">
                                            {activity.map(activityRow)}
                                        </ol>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </CardContent>
                </Card>
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <Tabs defaultValue="shop">
                            <TabsList className="bg-muted/60 h-9 w-full">
                                <TabsIndicator className="bg-background shadow-sm" />
                                <TabsTrigger value="shop">
                                    <Users className="size-4" /> In the shop
                                </TabsTrigger>
                                <TabsTrigger value="roles" className="relative">
                                    <ShieldCheck className="size-4" /> Missing roles
                                    {missingRoles.length > 0 && (
                                        <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-amber-950 tabular-nums">
                                            {missingRoles.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="shop" className="pt-4">
                                <CardDescription>
                                    Live attendance from the check-in message.
                                </CardDescription>
                                <div className="pt-4">
                                    {status.checkedIn.length === 0 ? (
                                        <div className="text-muted-foreground flex min-h-36 flex-col items-center justify-center gap-2 text-sm">
                                            <Check className="text-primary size-5" /> Nobody checked
                                            in
                                        </div>
                                    ) : (
                                        <ul className="space-y-2">
                                            {status.checkedIn.map((member) => (
                                                <li
                                                    key={`${member.name}-${member.since}`}
                                                    className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm"
                                                >
                                                    <span className="truncate font-medium">
                                                        {member.name}
                                                    </span>
                                                    <span className="text-muted-foreground shrink-0 text-xs">
                                                        {formatTime(member.since)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="roles" className="pt-4">
                                <CardDescription>
                                    Roles requested by Notion that Discord could not find.
                                </CardDescription>
                                {missingRoles.length === 0 ? (
                                    <div className="text-muted-foreground flex min-h-36 flex-col items-center justify-center gap-2 text-sm">
                                        <ShieldCheck className="text-primary size-5" /> All
                                        requested roles exist
                                    </div>
                                ) : (
                                    <ul className="mt-4 space-y-2">
                                        {missingRoles.map((roleName) => (
                                            <li
                                                key={roleName}
                                                className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5"
                                            >
                                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                                    {roleName}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardHeader>
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
                                    <span className="min-w-0 wrap-break-word text-zinc-300">
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
