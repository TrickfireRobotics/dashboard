"use client";

import { Lock, LockOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function minutesLeft(expiresAt: number): number {
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
}

/**
 * The vault's lock strip: states the lock, and holds the password prompt that
 * unlocks it. Reveals are gated server-side too - this only mirrors that state.
 */
export function VaultLock({
    unlocked,
    expiresAt,
    promptOpen,
    onPromptOpenChange,
    onUnlocked,
    onLocked,
}: {
    unlocked: boolean;
    expiresAt: number | null;
    promptOpen: boolean;
    onPromptOpenChange: (open: boolean) => void;
    onUnlocked: (expiresAt: number) => void;
    onLocked: () => void;
}) {
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [remaining, setRemaining] = useState(() => (expiresAt ? minutesLeft(expiresAt) : 0));

    // Keep the countdown honest, and flip the UI back to locked on its own.
    useEffect(() => {
        if (!unlocked || !expiresAt) return;
        setRemaining(minutesLeft(expiresAt));
        const tick = setInterval(() => {
            const left = minutesLeft(expiresAt);
            setRemaining(left);
            if (left === 0) onLocked();
        }, 15_000);
        return () => clearInterval(tick);
    }, [unlocked, expiresAt, onLocked]);

    async function unlock() {
        if (!password) return;
        setBusy(true);
        try {
            const res = await fetch("/api/vault/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Could not unlock the vault");
            setPassword("");
            onPromptOpenChange(false);
            onUnlocked(data.expiresAt as number);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    async function lock() {
        setBusy(true);
        try {
            await fetch("/api/vault/unlock", { method: "DELETE" });
            onLocked();
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <div
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 ${
                    unlocked
                        ? "border-emerald-500/30 bg-emerald-500/8"
                        : "border-border bg-muted/30"
                }`}
            >
                <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        unlocked
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted-foreground/10 text-muted-foreground"
                    }`}
                >
                    {unlocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                        {unlocked ? "Vault unlocked" : "Vault locked"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                        {unlocked
                            ? `Secrets can be revealed for the next ${remaining} minute${remaining === 1 ? "" : "s"}.`
                            : "Sign-ins last for weeks, so revealing a secret needs your password again."}
                    </p>
                </div>
                {unlocked ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={lock}>
                        <Lock className="size-4" />
                        Lock now
                    </Button>
                ) : (
                    <Button size="sm" onClick={() => onPromptOpenChange(true)}>
                        <LockOpen className="size-4" />
                        Unlock
                    </Button>
                )}
            </div>

            <Dialog
                open={promptOpen}
                onOpenChange={(open) => {
                    if (!open) setPassword("");
                    onPromptOpenChange(open);
                }}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Confirm it&apos;s you</DialogTitle>
                        <DialogDescription>
                            Enter your dashboard password to unlock the vault for 10 minutes.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void unlock();
                        }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="vault-password">Password</Label>
                            <Input
                                id="vault-password"
                                type="password"
                                autoComplete="current-password"
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => onPromptOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={busy || !password}>
                                {busy ? "Unlocking..." : "Unlock vault"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
