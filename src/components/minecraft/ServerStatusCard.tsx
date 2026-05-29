"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-lg text-foreground">{value}</p>
    </div>
  );
}

export function ServerStatusCard() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/minecraft/status", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as ServerStatus);
    } catch {
      // Leave previous status in place on a transient fetch error.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Server Status</CardTitle>
          {status ? (
            <Badge variant={status.online ? "default" : "destructive"}>
              {status.online ? "Online" : "Offline"}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          {status ? `${status.host}:${status.port}` : "Checking server…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && !status ? (
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : status?.online ? (
          <div className="grid grid-cols-3 gap-4">
            <Stat
              label="Players"
              value={`${status.playersOnline ?? 0} / ${status.playersMax ?? 0}`}
            />
            <Stat
              label="Latency"
              value={status.latencyMs != null ? `${status.latencyMs} ms` : "—"}
            />
            <Stat label="Version" value={status.version ?? "—"} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The server is offline or unreachable right now.
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
