"use client";

import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function SecretField({ entryId }: { entryId: number }) {
    const [value, setValue] = useState<string | null>(null);
    const [shown, setShown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Fetch + cache the decrypted secret. Returns null on failure (toasts).
    const fetchSecret = useCallback(async (): Promise<string | null> => {
        if (value !== null) return value;
        setLoading(true);
        try {
            const res = await fetch(`/api/vault/${entryId}/reveal`);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to reveal secret");
            }
            const data = (await res.json()) as { secret: string };
            setValue(data.secret);
            return data.secret;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
            return null;
        } finally {
            setLoading(false);
        }
    }, [entryId, value]);

    async function toggleReveal() {
        if (shown) {
            setShown(false);
            return;
        }
        const secret = await fetchSecret();
        if (secret === null) return;
        setShown(true);
    }

    async function copy() {
        const secret = await fetchSecret();
        if (secret === null) return;
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Clipboard unavailable");
        }
    }

    return (
        <div className="flex items-center gap-2">
            <code className="bg-muted min-w-32 max-w-[16rem] rounded px-2 py-1 font-mono text-xs break-all">
                {shown ? (value ?? "") : "••••••••••••"}
            </code>

            <Button
                size="icon-sm"
                variant="ghost"
                onClick={toggleReveal}
                disabled={loading}
                aria-label={shown ? "Hide secret" : "Reveal secret"}
                title={shown ? "Hide" : "Reveal"}
            >
                {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : shown ? (
                    <EyeOff className="size-4" />
                ) : (
                    <Eye className="size-4" />
                )}
            </Button>

            <Button
                size="icon-sm"
                variant="ghost"
                onClick={copy}
                disabled={loading}
                aria-label="Copy secret"
                title="Copy"
            >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
        </div>
    );
}
