"use client";

import { useCallback, useState } from "react";

import { CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePoll } from "@/lib/use-poll";

type NetworkStatus = {
    online: boolean;
    configured: boolean;
    nodeCount: number;
    onlineCount: number;
};

function PingDot({ online }: { online: boolean }) {
    if (!online) return <span className="bg-muted-foreground/40 size-2.5 rounded-full" />;
    return (
        <span className="relative flex size-2.5">
            <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
            <span className="bg-primary relative inline-flex size-2.5 rounded-full" />
        </span>
    );
}

export function NetworkStatusTile() {
    const [status, setStatus] = useState<NetworkStatus | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/network/status", { cache: "no-store" });
            if (res.ok) setStatus((await res.json()) as NetworkStatus);
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
                        {status.online ? "Connected" : "Offline"}
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                {status.online ? (
                    <p className="text-foreground text-3xl leading-none font-semibold tabular-nums">
                        {status.onlineCount}
                        <span className="text-muted-foreground text-lg font-normal">
                            /{status.nodeCount}
                        </span>
                    </p>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {status.configured ? "API unreachable" : "Not configured"}
                    </p>
                )}
                <p className="text-muted-foreground mt-2 text-xs">Tailscale · Private VPN</p>
            </CardContent>
        </>
    );
}
