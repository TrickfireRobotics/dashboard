"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { VaultMember } from "@/components/vault/VaultManager";

export function VaultAccessDialog({
    open,
    onOpenChange,
    entryId,
    entryName,
    members,
    grantedUserIds,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entryId: number;
    entryName: string;
    members: VaultMember[];
    grantedUserIds: string[];
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const granted = new Set(grantedUserIds);

    async function toggle(member: VaultMember, grant: boolean) {
        setBusy(member.id);
        try {
            const res = await fetch(`/api/admin/vault/${entryId}/access`, {
                method: grant ? "POST" : "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: member.id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to update access");
            }
            toast.success(grant ? `Granted ${member.name}` : `Revoked ${member.name}`);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage access</DialogTitle>
                    <DialogDescription>
                        Choose who can fetch <span className="font-medium">{entryName}</span> from
                        its key endpoint. Admins always have access.
                    </DialogDescription>
                </DialogHeader>

                <div className="-mx-1 max-h-80 space-y-1 overflow-y-auto px-1">
                    {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                            <div className="min-w-0">
                                <p className="text-foreground truncate text-sm font-medium">
                                    {m.name}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                            </div>
                            {m.isAdmin ? (
                                <Badge variant="secondary">Always (admin)</Badge>
                            ) : (
                                <Button
                                    size="sm"
                                    variant={granted.has(m.id) ? "default" : "outline"}
                                    disabled={busy === m.id}
                                    onClick={() => toggle(m, !granted.has(m.id))}
                                >
                                    {granted.has(m.id) ? "Granted" : "No access"}
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
