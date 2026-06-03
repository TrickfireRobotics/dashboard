"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

    useEffect(() => {
        load();
        const id = setInterval(load, 30_000);
        return () => clearInterval(id);
    }, [load]);

    const isOnline = status?.online ?? false;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Network Status</CardTitle>
                    {status ? (
                        <Badge variant={isOnline ? "default" : "secondary"}>
                            {isOnline ? "Online" : "Offline"}
                        </Badge>
                    ) : null}
                </div>
                <CardDescription>
                    {loading && !status
                        ? "Checking network…"
                        : !status?.configured
                          ? "Tailscale not configured"
                          : isOnline
                            ? `${status.nodeCount} device${status.nodeCount !== 1 ? "s" : ""} registered`
                            : "Tailscale API unreachable"}
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                <div className="mt-4">
                    <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className="size-4" />
                        Refresh
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
