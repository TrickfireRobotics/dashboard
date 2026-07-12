"use client";

import { useCallback, useState } from "react";

import { OnlinePlayersCard } from "./OnlinePlayersCard";
import { ServerInfoCard } from "./ServerInfoCard";
import { usePoll } from "@/lib/use-poll";

type PlayerSample = { name: string; uuid: string; isBot: boolean };

type ServerStatus = {
    online: boolean;
    playersOnline: number | null;
    playersMax: number | null;
    playerSample: PlayerSample[] | null;
    latencyMs: number | null;
    version: string | null;
    host: string;
    port: number;
    botSkinUrl: string | null;
};

export function ServerStatusSection() {
    const [status, setStatus] = useState<ServerStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/minecraft/status", { cache: "no-store" });
            if (res.ok) setStatus((await res.json()) as ServerStatus);
        } catch {
            // keep previous status on transient error
        } finally {
            setLoading(false);
        }
    }, []);

    usePoll(load, 30_000);

    return (
        // display:contents makes this wrapper transparent to the CSS grid,
        // so both child cards become direct grid items.
        <div className="contents">
            <ServerInfoCard status={status} loading={loading} onRefresh={load} />
            <OnlinePlayersCard status={status} loading={loading} />
        </div>
    );
}
