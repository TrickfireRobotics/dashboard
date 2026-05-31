"use client";

import { ExternalLink, Map } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function BluemapEmbed() {
    const [available, setAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);

        fetch("/bluemap", { method: "HEAD", signal: controller.signal })
            .then((r) => setAvailable(r.ok))
            .catch(() => setAvailable(false))
            .finally(() => clearTimeout(timer));

        return () => controller.abort();
    }, []);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Map className="text-muted-foreground size-5" />
                        <CardTitle>World Map</CardTitle>
                    </div>
                    {available && (
                        <a
                            href="/bluemap"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                        >
                            <ExternalLink className="size-4" />
                            Open
                        </a>
                    )}
                </div>
                <CardDescription>Live BlueMap view of the server world.</CardDescription>
            </CardHeader>

            <CardContent className={cn(available ? "p-0" : undefined)}>
                {available === null ? (
                    <Skeleton className="h-[520px] rounded-none rounded-b-xl" />
                ) : available ? (
                    <iframe
                        src="/bluemap"
                        title="BlueMap World Map"
                        className="h-[520px] w-full rounded-b-xl border-0"
                        allowFullScreen
                    />
                ) : (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
                        <Map className="text-muted-foreground size-8" />
                        <div className="text-center">
                            <p className="text-foreground text-sm font-medium">Map unavailable</p>
                            <p className="text-muted-foreground text-sm">
                                BlueMap is not running or unreachable.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
