"use client";

import { useEffect, useRef, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AzaleaConfig } from "@/lib/azalea";

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-muted-foreground mt-5 mb-3 text-xs font-medium tracking-wider uppercase">
            {children}
        </p>
    );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-muted-foreground shrink-0 text-sm">{label}</span>
            <span className="text-foreground break-all text-right font-mono text-sm">
                {value ?? <span className="text-muted-foreground italic">none</span>}
            </span>
        </div>
    );
}

function ScrollableMods({ entries }: { entries: [string, string][] }) {
    const ref = useRef<HTMLDivElement>(null);
    const [showTop, setShowTop] = useState(false);
    const [showBottom, setShowBottom] = useState(false);

    function update() {
        const el = ref.current;
        if (!el) return;
        setShowTop(el.scrollTop > 0);
        setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    }

    useEffect(() => {
        update();
    }, []);

    return (
        <div className="relative">
            <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-card to-transparent z-10 transition-opacity duration-150 ${showTop ? "opacity-100" : "opacity-0"}`}
            />
            <div
                ref={ref}
                onScroll={update}
                className="divide-border max-h-64 divide-y overflow-y-auto"
            >
                {entries.map(([name, version]) => (
                    <div
                        key={name}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 px-3 py-1.5"
                    >
                        <span className="font-mono text-sm">{name}</span>
                        <span className="text-muted-foreground font-mono text-xs">{version}</span>
                    </div>
                ))}
            </div>
            <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent z-10 transition-opacity duration-150 ${showBottom ? "opacity-100" : "opacity-0"}`}
            />
        </div>
    );
}

export function ServerConfigEditor({ initial }: { initial: AzaleaConfig }) {
    const modEntries = Object.entries(initial.mods) as [string, string][];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pack Info</CardTitle>
                <CardDescription>
                    Managed by azalea — use azalea server update to change.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <SectionLabel>Source</SectionLabel>
                <div className="border-border divide-border divide-y rounded-md border px-3">
                    <InfoRow label="Source" value={initial.source} />
                    <InfoRow label="Pinned tag" value={initial.pinned_tag} />
                    <InfoRow label="Installed tag" value={initial.installed_tag} />
                </div>

                <SectionLabel>Pack</SectionLabel>
                <div className="border-border divide-border divide-y rounded-md border px-3">
                    <InfoRow label="Name" value={initial.pack.name} />
                    <InfoRow label="Version" value={initial.pack.version} />
                    <InfoRow label="Minecraft version" value={initial.pack.minecraft_version} />
                    <InfoRow label="Loader" value={initial.pack.loader} />
                    <InfoRow label="Loader version" value={initial.pack.loader_version} />
                </div>

                <SectionLabel>Mods ({modEntries.length})</SectionLabel>
                <div className="border-border rounded-md border overflow-hidden">
                    <div className="border-border grid grid-cols-[1fr_auto] border-b px-3 py-2">
                        <span className="text-muted-foreground text-xs font-medium">Mod ID</span>
                        <span className="text-muted-foreground text-xs font-medium">Version</span>
                    </div>
                    <ScrollableMods entries={modEntries} />
                </div>
            </CardContent>
        </Card>
    );
}
