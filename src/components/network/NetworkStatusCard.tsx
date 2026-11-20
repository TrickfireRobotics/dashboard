"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { OsIcon } from "@/components/network/OsIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePoll } from "@/lib/use-poll";
import { formatRelativeTime } from "@/lib/utils";

type Platform = { name: string; count: number };

type Status = {
    online: boolean;
    configured: boolean;
    nodeCount: number;
    onlineCount: number;
    ownerCount?: number;
    staleCount?: number;
    lastActivity?: string | null;
    tailnet?: string | null;
    platforms?: Platform[];
};

function Stat({
    label,
    value,
    hint,
    tone = "default",
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "primary" | "muted";
}) {
    return (
        <div className="px-5 py-3.5">
            <dt className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
                <span
                    className={`text-2xl leading-none font-semibold tabular-nums ${
                        tone === "primary"
                            ? "text-primary"
                            : tone === "muted"
                              ? "text-muted-foreground"
                              : "text-foreground"
                    }`}
                >
                    {value}
                </span>
                {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
            </dd>
        </div>
    );
}

export function NetworkStatusCard() {
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/network/status", { cache: "no-store" });
            if (res.ok) setStatus((await res.json()) as Status);
        } catch {
            // Leave previous status on transient error.
        } finally {
            setLoading(false);
        }
    }, []);

    usePoll(load, 30_000);

    const isOnline = status?.online ?? false;
    const platforms = status?.platforms ?? [];

    return (
        <section className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        className={`size-2.5 shrink-0 rounded-full shadow-[0_0_0_5px] ${
                            loading && !status
                                ? "bg-muted-foreground/40 shadow-muted-foreground/10"
                                : isOnline
                                  ? "bg-emerald-500 shadow-emerald-500/20"
                                  : "bg-destructive shadow-destructive/20"
                        }`}
                    />
                    <div className="min-w-0">
                        <p className="font-heading text-base font-medium">
                            {loading && !status
                                ? "Checking network…"
                                : !status?.configured
                                  ? "Tailscale not configured"
                                  : isOnline
                                    ? "Network online"
                                    : "Tailscale API unreachable"}
                        </p>
                        <p className="text-muted-foreground truncate text-sm">
                            {loading && !status
                                ? "Asking the Tailscale API for devices."
                                : !status?.configured
                                  ? "Tailscale is not yet set up on this server."
                                  : !isOnline
                                    ? "The Tailscale API is unreachable. Contact an admin."
                                    : [
                                          status.tailnet
                                              ? `Tailnet ${status.tailnet}`
                                              : "Tailscale",
                                          status.lastActivity
                                              ? `last activity ${formatRelativeTime(status.lastActivity)}`
                                              : null,
                                      ]
                                          .filter(Boolean)
                                          .join(" · ")}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {platforms.map((p) => (
                        <span
                            key={p.name}
                            className="bg-muted/60 text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
                            title={`${p.count} ${p.name} device${p.count === 1 ? "" : "s"}`}
                        >
                            <OsIcon os={p.name} className="size-3.5" />
                            {p.name}
                            <span className="text-muted-foreground tabular-nums">{p.count}</span>
                        </span>
                    ))}
                    <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {loading && !status ? (
                <div className="border-border grid grid-cols-2 gap-4 border-t p-5 sm:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                    ))}
                </div>
            ) : isOnline ? (
                <dl className="border-border *:border-border grid grid-cols-2 border-t sm:grid-cols-4 [&>*:nth-child(even)]:border-l sm:[&>*:nth-child(n+2)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0">
                    <Stat label="Devices" value={String(status!.nodeCount)} />
                    <Stat
                        label="Online now"
                        value={String(status!.onlineCount)}
                        hint={status!.nodeCount > 0 ? `of ${status!.nodeCount}` : undefined}
                        tone="primary"
                    />
                    <Stat label="Owners" value={String(status!.ownerCount ?? 0)} />
                    <Stat
                        label="Idle"
                        value={String(status!.staleCount ?? 0)}
                        hint="30d+"
                        tone={status!.staleCount ? "default" : "muted"}
                    />
                </dl>
            ) : null}
        </section>
    );
}
