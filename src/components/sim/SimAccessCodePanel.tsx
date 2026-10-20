"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Expand, RefreshCw } from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { rotateSimAccessCode } from "@/lib/sim/access-code-actions";

function grouped(code: string): string {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function countdown(until: number): string {
    const left = Math.max(0, until - Date.now());
    const hours = Math.floor(left / 3_600_000);
    const minutes = Math.floor((left % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function SimAccessCodePanel({
    code: initialCode,
    rotatesAt: initialRotatesAt,
    rotatesAtLabel,
}: {
    code: string;
    rotatesAt: string;
    rotatesAtLabel: string;
}) {
    const router = useRouter();
    const [code, setCode] = useState(initialCode);
    const [rotatesAt, setRotatesAt] = useState(initialRotatesAt);
    const [remaining, setRemaining] = useState(() => countdown(Date.parse(initialRotatesAt)));
    const [presenting, setPresenting] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isRotating, startRotate] = useTransition();

    useEffect(() => {
        setCode(initialCode);
        setRotatesAt(initialRotatesAt);
    }, [initialCode, initialRotatesAt]);

    useEffect(() => {
        const until = Date.parse(rotatesAt);
        const tick = setInterval(() => {
            if (Date.now() >= until) router.refresh();
            setRemaining(countdown(until));
        }, 30_000);
        return () => clearInterval(tick);
    }, [rotatesAt, router]);

    async function handleCopy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleRotate() {
        setConfirming(false);
        startRotate(async () => {
            try {
                const next = await rotateSimAccessCode();
                setCode(next.code);
                setRotatesAt(next.rotatesAt);
                setRemaining(countdown(Date.parse(next.rotatesAt)));
                toast.success("New code generated, the old one no longer works");
                router.refresh();
            } catch {
                toast.error("Could not rotate the code");
            }
        });
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Sim access code</CardTitle>
                    <CardDescription>
                        Members need this to pull a robot from OnShape with{" "}
                        <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                            sim gazebo create
                        </code>
                        . One code for the whole club, no dashboard account needed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            type="button"
                            onClick={handleCopy}
                            title="Click to copy"
                            className="bg-muted hover:bg-muted/70 cursor-pointer rounded-lg px-6 py-4 font-mono text-5xl font-bold tracking-[0.2em] tabular-nums transition-colors"
                        >
                            {grouped(code)}
                        </button>
                        <div className="flex flex-col gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPresenting(true)}>
                                <Expand /> Present
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isRotating}
                                onClick={() => setConfirming(true)}
                            >
                                <RefreshCw /> {isRotating ? "Rotating…" : "Refresh now"}
                            </Button>
                        </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                        Rotates on its own in {remaining}, at {rotatesAtLabel}. Anyone with the code
                        can export CAD through the dashboard until then, so keep it in club
                        channels.
                    </p>
                </CardContent>
            </Card>

            <Dialog open={presenting} onOpenChange={setPresenting}>
                <DialogContent className="flex h-screen max-h-none w-screen max-w-none flex-col items-center justify-center gap-8 rounded-none sm:max-w-none">
                    <DialogTitle className="text-muted-foreground text-2xl font-normal">
                        Sim access code
                    </DialogTitle>
                    <p className="font-mono text-[14vw] leading-none font-bold tracking-[0.1em] tabular-nums">
                        {grouped(code)}
                    </p>
                    <p className="text-muted-foreground text-xl">
                        Run <code className="font-mono">sim gazebo create</code> and enter this when
                        asked. Rotates at {rotatesAtLabel}.
                    </p>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Generate a new code now?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The current code stops working immediately. Anyone mid-export will have
                            to ask for the new one.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRotate}>New code</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
