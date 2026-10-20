"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function countdown(until: number): string {
    const left = Math.max(0, until - Date.now());
    const hours = Math.floor(left / 3_600_000);
    const minutes = Math.floor((left % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function SimAccessCodePanel({
    code,
    rotatesAt,
    rotatesAtLabel,
}: {
    code: string;
    rotatesAt: string;
    rotatesAtLabel: string;
}) {
    const router = useRouter();
    const until = new Date(rotatesAt).getTime();
    const [remaining, setRemaining] = useState(() => countdown(until));
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const id = setInterval(() => {
            if (Date.now() >= until) router.refresh();
            setRemaining(countdown(until));
        }, 30_000);
        return () => clearInterval(id);
    }, [until, router]);

    async function handleCopy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <CardTitle>Sim access code</CardTitle>
                <CardDescription>
                    Today&apos;s code for{" "}
                    <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                        sim gazebo auth
                    </code>
                    . Share it with members who need to import or update a robot from OnShape - they
                    do not need a dashboard account.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                    <p className="bg-muted rounded-md px-4 py-3 font-mono text-3xl font-bold tracking-[0.3em] tabular-nums">
                        {code}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? "Copied!" : "Copy"}
                    </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                    Rotates in {remaining}, at {rotatesAtLabel}. Anyone with the code can export CAD
                    through the dashboard for the rest of the day, so keep it in club channels.
                </p>
            </CardContent>
        </Card>
    );
}
