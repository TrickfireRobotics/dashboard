"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCliApiKey, revokeCliApiKey } from "@/lib/sim/apikey-actions";

type Key = {
    prefix: string;
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
};

export function SimApiKeyPanel({ initialKeys }: { initialKeys: Key[] }) {
    const router = useRouter();
    const [keys, setKeys] = useState(initialKeys);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isCreating, startCreate] = useTransition();
    const [revokingPrefix, setRevokingPrefix] = useState<string | null>(null);

    function handleCreate() {
        startCreate(async () => {
            try {
                const { raw } = await createCliApiKey();
                setNewKey(raw);
                router.refresh();
            } catch {
                toast.error("Failed to generate key");
            }
        });
    }

    async function handleRevoke(prefix: string) {
        setRevokingPrefix(prefix);
        try {
            await revokeCliApiKey(prefix);
            setKeys((prev) => prev.filter((k) => k.prefix !== prefix));
            if (newKey?.startsWith(prefix)) setNewKey(null);
            toast.success("Key revoked");
        } catch {
            toast.error("Failed to revoke key");
        } finally {
            setRevokingPrefix(null);
        }
    }

    async function handleCopy() {
        if (!newKey) return;
        await navigator.clipboard.writeText(newKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <CardTitle>CLI access</CardTitle>
                <CardDescription>
                    Generate an API key for use with{" "}
                    <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">sim auth</code>{" "}
                    on your local machine.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {newKey && (
                    <div className="space-y-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3">
                        <p className="text-sm font-medium">
                            Copy this key - it won&apos;t be shown again.
                        </p>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={newKey}
                                className="font-mono text-xs"
                                onFocus={(e) => e.target.select()}
                            />
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setNewKey(null)}
                        >
                            Dismiss
                        </Button>
                    </div>
                )}

                {keys.length > 0 && (
                    <div className="space-y-2">
                        {keys.map((k) => (
                            <div
                                key={k.prefix}
                                className="flex items-center justify-between rounded-md border px-3 py-2"
                            >
                                <div className="space-y-0.5">
                                    <p className="text-muted-foreground font-mono text-xs">
                                        {k.prefix}…
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Created{" "}
                                        {new Date(k.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                        {k.lastUsedAt &&
                                            ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    disabled={revokingPrefix === k.prefix}
                                    onClick={() => handleRevoke(k.prefix)}
                                >
                                    {revokingPrefix === k.prefix ? "Revoking…" : "Revoke"}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating ? "Generating…" : "Generate new key"}
                </Button>
            </CardContent>
        </Card>
    );
}
