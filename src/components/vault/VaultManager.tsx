"use client";

import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntryName } from "@/components/vault/EntryName";
import { KeyEndpointField } from "@/components/vault/KeyEndpointField";
import { SecretField } from "@/components/vault/SecretField";
import { VaultAccessDialog } from "@/components/vault/VaultAccessDialog";
import { VaultEntryDialog, type VaultEntryRow } from "@/components/vault/VaultEntryDialog";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

const TYPE_LABEL = { login: "Login", api_key: "API key" } as const;

export type VaultMember = {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
};

export function VaultManager({
    entries,
    isAdmin,
    members,
    grants,
}: {
    entries: VaultEntryRow[];
    isAdmin: boolean;
    // Admin-only: roster + entryId -> granted userIds, for managing access.
    members: VaultMember[];
    grants: Record<number, string[]>;
}) {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<VaultEntryRow | undefined>(undefined);
    const [accessEntry, setAccessEntry] = useState<VaultEntryRow | undefined>(undefined);
    const [busy, setBusy] = useState<number | null>(null);

    function openCreate() {
        setEditing(undefined);
        setDialogOpen(true);
    }

    function openEdit(entry: VaultEntryRow) {
        setEditing(entry);
        setDialogOpen(true);
    }

    async function remove(entry: VaultEntryRow) {
        if (!confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
        setBusy(entry.id);
        try {
            const res = await fetch(`/api/admin/vault/${entry.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to delete");
            }
            toast.success("Entry deleted");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-4">
            {isAdmin ? (
                <div className="flex justify-end">
                    <Button onClick={openCreate}>
                        <Plus className="size-4" />
                        New entry
                    </Button>
                </div>
            ) : null}

            {entries.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    No vault entries yet.
                </div>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Username</TableHead>
                                <TableHead>Secret</TableHead>
                                <TableHead>Added</TableHead>
                                {isAdmin ? (
                                    <TableHead className="text-right">Actions</TableHead>
                                ) : null}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((e) => (
                                <TableRow key={e.id}>
                                    <TableCell className="text-foreground font-medium">
                                        <EntryName name={e.name} />
                                        {e.description ? (
                                            <p className="text-muted-foreground max-w-[16rem] text-xs font-normal break-words">
                                                {e.description}
                                            </p>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {TYPE_LABEL[e.type]}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {e.type === "login" ? e.username : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {e.type === "api_key" ? (
                                            <KeyEndpointField entryId={e.id} />
                                        ) : (
                                            <SecretField entryId={e.id} />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(e.createdAt)}
                                    </TableCell>
                                    {isAdmin ? (
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    disabled={busy === e.id}
                                                    onClick={() => setAccessEntry(e)}
                                                    aria-label="Manage access"
                                                    title="Manage access"
                                                >
                                                    <KeyRound className="size-4" />
                                                </Button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    disabled={busy === e.id}
                                                    onClick={() => openEdit(e)}
                                                    aria-label="Edit entry"
                                                    title="Edit"
                                                >
                                                    <Pencil className="size-4" />
                                                </Button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    disabled={busy === e.id}
                                                    onClick={() => remove(e)}
                                                    aria-label="Delete entry"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="text-destructive size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    ) : null}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {isAdmin ? (
                <VaultEntryDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    entry={editing}
                />
            ) : null}

            {isAdmin && accessEntry ? (
                <VaultAccessDialog
                    open={accessEntry !== undefined}
                    onOpenChange={(open) => {
                        if (!open) setAccessEntry(undefined);
                    }}
                    entryId={accessEntry.id}
                    entryName={accessEntry.name}
                    members={members}
                    grantedUserIds={grants[accessEntry.id] ?? []}
                />
            ) : null}
        </div>
    );
}
