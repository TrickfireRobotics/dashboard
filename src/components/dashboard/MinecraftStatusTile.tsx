"use client";

import { useCallback, useState } from "react";

import { CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ServerStatus } from "@/lib/minecraft";
import { usePoll } from "@/lib/use-poll";

function PingDot({ online }: { online: boolean }) {
    if (!online) return <span className="bg-muted-foreground/40 size-2.5 rounded-full" />;
    return (
        <span className="relative flex size-2.5">
            <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
            <span className="bg-primary relative inline-flex size-2.5 rounded-full" />
        </span>
    );
}

export function MinecraftStatusTile() {
    const [status, setStatus] = useState<ServerStatus | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/minecraft/status", { cache: "no-store" });
            if (res.ok) setStatus((await res.json()) as ServerStatus);
        } catch {
            // Keep previous data on transient error.
        }
    }, []);

    usePoll(load, 30_000);

    if (!status) {
        return (
            <>
                <CardHeader className="pb-1">
                    <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="mt-2 h-3 w-24" />
                </CardContent>
            </>
        );
    }

    return (
        <>
            <CardHeader className="pb-1">
                <div className="flex items-center gap-2">
                    <PingDot online={status.online} />
                    <span className="text-muted-foreground text-xs tracking-wider uppercase">
                        {status.online ? "Online" : "Offline"}
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                {status.online ? (
                    <p className="text-foreground text-3xl leading-none font-semibold tabular-nums">
                        {status.playersOnline}
                        <span className="text-muted-foreground text-lg font-normal">
                            /{status.playersMax}
                        </span>
                    </p>
                ) : (
                    <p className="text-muted-foreground text-sm">Server unreachable</p>
                )}
                <p className="text-muted-foreground mt-2 text-xs">
                    {status.host}:{status.port}
                </p>
            </CardContent>
        </>
    );
}
