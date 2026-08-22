"use client";

import { CheckCircle2, MessageSquareOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { FeedbackCategoryBadge } from "./FeedbackCategoryBadge";

export type FeedbackRow = {
    id: number;
    category: FeedbackCategory;
    message: string;
    page: string | null;
    status: FeedbackStatus;
    createdAt: string;
    authorName: string | null;
};

function formatWhen(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function FeedbackItem({ row, onChanged }: { row: FeedbackRow; onChanged: () => void }) {
    const [updating, setUpdating] = useState(false);
    const resolved = row.status === "resolved";

    async function toggleStatus() {
        setUpdating(true);
        try {
            const res = await fetch(`/api/feedback/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: resolved ? "open" : "resolved" }),
            });
            if (!res.ok) throw new Error("Update failed");
            onChanged();
        } catch {
            toast.error("Couldn't update that item");
        } finally {
            setUpdating(false);
        }
    }

    return (
        <li
            className={cn(
                "border-border rounded-lg border p-3 transition-colors",
                resolved && "bg-muted/30"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <FeedbackCategoryBadge category={row.category} />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={updating}
                    onClick={toggleStatus}
                    aria-label={resolved ? "Reopen" : "Mark resolved"}
                    title={resolved ? "Reopen" : "Mark resolved"}
                    className={resolved ? "text-primary" : "text-muted-foreground"}
                >
                    {resolved ? <RotateCcw /> : <CheckCircle2 />}
                </Button>
            </div>
            <p
                className={cn(
                    "mt-2 text-sm whitespace-pre-wrap",
                    resolved && "text-muted-foreground"
                )}
            >
                {row.message}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
                {row.authorName ?? "Someone"} · {formatWhen(row.createdAt)}
                {row.page ? ` · ${row.page}` : ""}
            </p>
        </li>
    );
}

export function FeedbackFeed({
    rows,
    loading,
    onChanged,
}: {
    rows: FeedbackRow[];
    loading: boolean;
    onChanged: () => void;
}) {
    if (loading && rows.length === 0) {
        return (
            <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <EmptyState
                icon={MessageSquareOff}
                title="No feedback yet"
                description="Be the first to share a bug, idea, or thought."
            />
        );
    }

    return (
        <ul className="space-y-3">
            {rows.map((row) => (
                <FeedbackItem key={row.id} row={row} onChanged={onChanged} />
            ))}
        </ul>
    );
}
