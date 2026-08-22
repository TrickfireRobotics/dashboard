"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePoll } from "@/lib/use-poll";

type Status = {
    online: boolean;
    configured: boolean;
    nodeCount: number;
    onlineCount: number;
};

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-muted-foreground text-xs tracking-wider uppercase">{label}</p>
            <p className="text-foreground text-lg">{value}</p>
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

    return (
        <div className="border-border rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-heading text-base font-medium">Network Status</p>
                    <p className="text-muted-foreground text-sm">
                        {loading && !status
                            ? "Checking network…"
                            : !status?.configured
                              ? "Tailscale not configured"
                              : isOnline
                                ? `${status.nodeCount} device${status.nodeCount !== 1 ? "s" : ""} registered`
                                : "Tailscale API unreachable"}
                    </p>
                </div>
                {status ? (
                    <Badge variant={isOnline ? "default" : "secondary"}>
                        {isOnline ? "Online" : "Offline"}
                    </Badge>
                ) : null}
            </div>

            <div className="mt-4">
                {loading && !status ? (
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </div>
                ) : isOnline ? (
                    <div className="grid grid-cols-2 gap-4">
                        <Stat label="Total devices" value={String(status!.nodeCount)} />
                        <Stat label="Currently online" value={String(status!.onlineCount)} />
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {status?.configured
                            ? "The Tailscale API is unreachable. Contact an admin."
                            : "Tailscale is not yet configured on this server."}
                    </p>
                )}
            </div>

            <div className="mt-4">
                <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                    <RefreshCw className="size-4" />
                    Refresh
                </Button>
            </div>
        </div>
    );
}
