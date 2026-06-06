"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";

// api_key secrets are never shown in the UI. Instead we surface the
// authenticated endpoint that returns the key, so a granted user (or their
// script, using the session cookie) can fetch it. See GET /api/vault/[id]/key.
export function KeyEndpointField({ entryId }: { entryId: number }) {
    const [copied, setCopied] = useState(false);
    const path = `/api/vault/${entryId}/key`;

    async function copy() {
        // Copy an absolute URL so it's usable from scripts as-is.
        const url =
            typeof window !== "undefined" ? new URL(path, window.location.origin).href : path;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            toast.success("Endpoint URL copied");
        } catch {
            toast.error("Clipboard unavailable");
        }
    }

    return (
        <div className="flex items-center gap-2">
            <code className="bg-muted rounded px-2 py-1 font-mono text-xs break-all">{path}</code>

            <Button
                size="icon-sm"
                variant="ghost"
                onClick={copy}
                aria-label="Copy endpoint URL"
                title="Copy endpoint URL"
            >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>

            <a
                href={path}
                target="_blank"
                rel="noreferrer"
                aria-label="Open endpoint"
                title="Open"
                className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
            >
                <ExternalLink className="size-4" />
            </a>
        </div>
    );
}
