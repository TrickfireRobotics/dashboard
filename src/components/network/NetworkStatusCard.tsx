"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatColumns } from "@/components/ui/stat-columns";
import { usePoll } from "@/lib/use-poll";

type Status = {
    online: boolean;
    configured: boolean;
    nodeCount: number;
    onlineCount: number;
};

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
        <section className="border-border bg-card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-lg border px-5 py-4">
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
                <p className="text-lg leading-snug font-semibold">
                    {loading && !status
                        ? "Checking network…"
                        : !status?.configured
                          ? "Tailscale not configured"
                          : isOnline
                            ? "Network online"
                            : "Tailscale API unreachable"}
                </p>
            </div>

            <div className="flex items-center gap-4">
                {isOnline ? (
                    <StatColumns
                        stats={[
                            { label: "Online", value: String(status!.onlineCount) },
                            { label: "Total", value: String(status!.nodeCount) },
                        ]}
                    />
                ) : null}
                <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                    <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>
        </section>
    );
}
