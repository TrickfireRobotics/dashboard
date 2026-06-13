"use client";

import { Cpu, HardDrive, MemoryStick, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SystemStats } from "@/app/api/system/stats/route";

function metricColor(pct: number): string {
    if (pct > 85) return "var(--destructive)";
    if (pct > 70) return "#f59e0b";
    return "var(--primary)";
}

function ProgressBar({ pct }: { pct: number }) {
    return (
        <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
            <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: metricColor(pct) }}
            />
        </div>
    );
}

function formatUptime(s: number): string {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

type MetricCardProps = {
    icon: React.ReactNode;
    title: string;
    value: string;
    subtext: string;
    pct?: number;
};

function MetricCard({ icon, title, value, subtext, pct }: MetricCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    {icon}
                    <span>{title}</span>
                </div>
                <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
            <CardContent>
                {pct !== undefined && <ProgressBar pct={pct} />}
                <p className="text-muted-foreground mt-2 text-xs">{subtext}</p>
            </CardContent>
        </Card>
    );
}

export function SystemVitals() {
    const [stats, setStats] = useState<SystemStats | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/system/stats", { cache: "no-store" });
            if (res.ok) setStats((await res.json()) as SystemStats);
        } catch {
            // Keep previous data on transient error.
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, 10_000);
        return () => clearInterval(id);
    }, [load]);

    if (!stats) {
        return (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="pt-6">
                            <Skeleton className="h-28" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
                icon={<Cpu className="size-4" />}
                title="CPU Load"
                value={`${stats.cpu.loadPercent}%`}
                pct={stats.cpu.loadPercent}
                subtext={`${stats.loadAvg.one} / ${stats.loadAvg.five} / ${stats.loadAvg.fifteen} avg`}
            />
            <MetricCard
                icon={<MemoryStick className="size-4" />}
                title="Memory"
                value={`${stats.memory.usedGb} / ${stats.memory.totalGb} GB`}
                pct={stats.memory.usedPercent}
                subtext={`${stats.memory.usedPercent}% used`}
            />
            <MetricCard
                icon={<HardDrive className="size-4" />}
                title="Disk"
                value={`${stats.disk.usedGb} / ${stats.disk.totalGb} GB`}
                pct={stats.disk.usedPercent}
                subtext={`${stats.disk.usedPercent}% used`}
            />
            <MetricCard
                icon={<Timer className="size-4" />}
                title="Uptime"
                value={formatUptime(stats.uptime.seconds)}
                subtext="Server uptime"
            />
        </div>
    );
}
