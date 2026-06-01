"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { FeatureKey } from "@/lib/features";

type FeatureRow = {
    key: FeatureKey;
    label: string;
    description: string;
    status: "pending" | "granted" | "rejected" | null;
};

function statusBadge(status: FeatureRow["status"]) {
    if (status === "granted") return <Badge variant="default">Active</Badge>;
    if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return null;
}

export function FeaturesPanel({
    features,
    deniedKey,
}: {
    features: FeatureRow[];
    deniedKey: string | null;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<FeatureKey | null>(null);
    const [notes, setNotes] = useState<Record<FeatureKey, string>>(
        {} as Record<FeatureKey, string>
    );
    const deniedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (deniedKey && deniedRef.current) {
            deniedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [deniedKey]);

    async function requestFeature(key: FeatureKey) {
        setBusy(key);
        try {
            const res = await fetch("/api/users/features", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featureKey: key, requestNote: notes[key] || undefined }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Request failed");
            }
            toast.success("Access requested");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => {
                const isDenied = deniedKey === f.key;
                const canRequest = f.status === null || f.status === "rejected";
                return (
                    <Card
                        key={f.key}
                        ref={isDenied ? deniedRef : undefined}
                        className={isDenied ? "ring-destructive ring-2" : undefined}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-base">{f.label}</CardTitle>
                                {statusBadge(f.status)}
                            </div>
                            <CardDescription>{f.description}</CardDescription>
                            {isDenied && (
                                <p className="text-destructive text-xs font-medium">
                                    You don&apos;t have access to this feature yet.
                                </p>
                            )}
                        </CardHeader>
                        {canRequest && (
                            <>
                                <CardContent className="pb-2">
                                    <textarea
                                        className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-md border px-3 py-2 text-sm"
                                        rows={2}
                                        placeholder="Optional: explain why you need access"
                                        value={notes[f.key] ?? ""}
                                        onChange={(e) =>
                                            setNotes((prev) => ({
                                                ...prev,
                                                [f.key]: e.target.value,
                                            }))
                                        }
                                    />
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        size="sm"
                                        onClick={() => requestFeature(f.key)}
                                        disabled={busy === f.key}
                                    >
                                        {f.status === "rejected"
                                            ? "Request again"
                                            : "Request access"}
                                    </Button>
                                </CardFooter>
                            </>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
