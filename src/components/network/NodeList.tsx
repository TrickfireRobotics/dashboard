"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { NetworkNode } from "@/lib/integrations/network";
import { usePoll } from "@/lib/use-poll";

function OnlineDot({ online }: { online: boolean }) {
    return (
        <span
            className={`inline-block size-2 rounded-full ${online ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
    );
}

function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export function NodeList() {
    const [nodes, setNodes] = useState<NetworkNode[] | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/network/nodes", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setNodes(data.nodes ?? []);
            }
        } catch {
            // leave previous state
        } finally {
            setLoading(false);
        }
    }, []);

    usePoll(load, 30_000);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Devices</CardTitle>
                    <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className="size-4" />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading && !nodes ? (
                    <div className="space-y-3">
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </div>
                ) : !nodes || nodes.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No devices connected to the network yet.
                    </p>
                ) : (
                    <ul className="divide-border divide-y">
                        {nodes.map((node) => (
                            <li
                                key={node.id}
                                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                            >
                                <OnlineDot online={node.online} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-foreground font-medium">{node.name}</p>
                                        {node.os && (
                                            <Badge
                                                variant="secondary"
                                                className="text-xs font-normal"
                                            >
                                                {node.os}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground font-mono text-xs">
                                        {node.ipAddresses?.join("  ") ?? "-"}
                                    </p>
                                </div>
                                <div className="text-muted-foreground shrink-0 text-right text-xs">
                                    <p>{node.user?.name ?? "-"}</p>
                                    <p>{relativeTime(node.lastSeen)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
