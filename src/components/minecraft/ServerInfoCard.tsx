import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ServerStatus = {
    online: boolean;
    playersOnline: number | null;
    playersMax: number | null;
    latencyMs: number | null;
    version: string | null;
    host: string;
    port: number;
};

type Props = {
    status: ServerStatus | null;
    loading: boolean;
    onRefresh: () => void;
};

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {label}
            </p>
            <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
    );
}

export function ServerInfoCard({ status, loading, onRefresh }: Props) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Server</CardTitle>
                    {loading && !status ? (
                        <Skeleton className="h-5 w-14" />
                    ) : status ? (
                        <Badge variant={status.online ? "default" : "destructive"}>
                            {status.online ? "Online" : "Offline"}
                        </Badge>
                    ) : null}
                </div>
                <CardDescription>
                    {status ? `${status.host}:${status.port}` : "Checking server…"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading && !status ? (
                    <div className="space-y-3">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </div>
                ) : status?.online ? (
                    <div className="space-y-3">
                        <StatBox
                            label="Players"
                            value={`${status.playersOnline ?? 0} / ${status.playersMax ?? 0}`}
                        />
                        <StatBox
                            label="Latency"
                            value={status.latencyMs != null ? `${status.latencyMs} ms` : "— ms"}
                        />
                        <StatBox label="Version" value={status.version ?? "—"} />
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        The server is offline or unreachable.
                    </p>
                )}
                <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
                    <RefreshCw className="size-4" />
                    Refresh
                </Button>
            </CardContent>
        </Card>
    );
}
