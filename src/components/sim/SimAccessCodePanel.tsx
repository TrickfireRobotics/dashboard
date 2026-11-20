"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Expand, RefreshCw } from "lucide-react";

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
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
            <Card className="border-primary/20 bg-primary/[0.03] ring-primary/15">
                <CardHeader>
                    <CardTitle>Sim access code</CardTitle>
                    <CardDescription>
                        Members need this to pull a robot from OnShape with{" "}
                        <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                            sim gazebo create
                        </code>
                        . One code for the whole club, no dashboard account needed.
                    </CardDescription>
                    <CardAction>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                {copied ? (
                                    <Check className="size-4" />
                                ) : (
                                    <Copy className="size-4" />
                                )}
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPresenting(true)}>
                                <Expand className="size-4" /> Present
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isRotating}
                                onClick={() => setConfirming(true)}
                            >
                                <RefreshCw className="size-4" />
                                {isRotating ? "Rotating…" : "Refresh now"}
                            </Button>
                        </div>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <button
                            type="button"
                            onClick={handleCopy}
                            title="Click to copy"
                            className="bg-muted hover:bg-muted/70 flex cursor-pointer items-center justify-center rounded-lg px-6 py-6 font-mono text-5xl font-bold tracking-[0.2em] tabular-nums transition-colors sm:text-6xl"
                        >
                            {grouped(code)}
                        </button>
                        <div className="border-border flex flex-col justify-center gap-1 rounded-lg border px-5 py-4 lg:w-64">
                            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                Rotates in
                            </p>
                            <p className="text-2xl leading-none font-semibold tabular-nums">
                                {remaining}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                                Automatically, at {rotatesAtLabel}. Anyone with the code can export
                                CAD until then, so keep it in club channels.
                            </p>
                        </div>
                    </div>
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
