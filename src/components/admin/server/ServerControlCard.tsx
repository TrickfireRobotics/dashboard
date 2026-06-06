"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = {
    running: boolean;
    configured: boolean;
    installedTag: string | null;
};

export function ServerControlCard({ initial }: { initial: Status }) {
    const [status, setStatus] = useState<Status>(initial);
    const [busy, setBusy] = useState(false);
    const [updating, setUpdating] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/server/status", { cache: "no-store" });
            if (res.ok) setStatus(await res.json());
        } catch {}
    }, []);

    useEffect(() => {
        const id = setInterval(refresh, 5000);
        return () => clearInterval(id);
    }, [refresh]);

    async function toggle() {
        setBusy(true);
        const action = status.running ? "stop" : "start";
        try {
            const res = await fetch(`/api/admin/server/${action}`, { method: "POST" });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Request failed");
            toast.success(action === "start" ? "Server starting…" : "Stop command sent");
            await new Promise((r) => setTimeout(r, 1500));
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    async function update() {
        setUpdating(true);
        try {
            const res = await fetch("/api/admin/server/update", { method: "POST" });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Request failed");
            toast.success("Update started - watch the log for progress");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setUpdating(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Server Control</CardTitle>
                <CardDescription>Start and stop the Minecraft server via azalea.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Status</span>
                    <Badge variant={status.running ? "default" : "secondary"}>
                        {status.running ? "Running" : "Stopped"}
                    </Badge>
                </div>

                {status.installedTag && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Version</span>
                        <span className="font-mono text-sm">{status.installedTag}</span>
                    </div>
                )}

                {!status.configured && (
                    <p className="text-destructive text-sm">
                        MINECRAFT_SERVER_PATH is not set or azalea-server.json not found.
                    </p>
                )}

                <Button
                    className="w-full"
                    variant={status.running ? "destructive" : "default"}
                    disabled={busy || !status.configured}
                    onClick={toggle}
                >
                    {busy ? "…" : status.running ? "Stop Server" : "Start Server"}
                </Button>

                <Button
                    className="w-full"
                    variant="outline"
                    disabled={updating || !status.configured}
                    onClick={update}
                >
                    {updating ? "Updating…" : "Update Server"}
                </Button>
            </CardContent>
        </Card>
    );
}
