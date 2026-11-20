"use client";

import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { EntryName } from "@/components/vault/EntryName";
import { SecretField } from "@/components/vault/SecretField";
import { VaultEntryDialog, type VaultEntryRow } from "@/components/vault/VaultEntryDialog";
import { VaultLock } from "@/components/vault/VaultLock";
import { Button } from "@/components/ui/button";
import { DataTableCard, DataTableCardHeader } from "@/components/ui/data-table-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export function VaultManager({
    entries,
    initialUnlockExpiresAt,
}: {
    entries: VaultEntryRow[];
    initialUnlockExpiresAt: number | null;
}) {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<VaultEntryRow | undefined>(undefined);
    const [busy, setBusy] = useState<number | null>(null);
    const [filter, setFilter] = useState("");
    const [unlockExpiresAt, setUnlockExpiresAt] = useState(initialUnlockExpiresAt);
    const [promptOpen, setPromptOpen] = useState(false);

    const unlocked = unlockExpiresAt !== null;
    const onLocked = useCallback(() => setUnlockExpiresAt(null), []);
    const needsUnlock = useCallback(() => {
        setUnlockExpiresAt(null);
        setPromptOpen(true);
    }, []);

    const needle = filter.trim().toLowerCase();
    const visible = useMemo(() => {
        if (!needle) return entries;
        return entries.filter((e) =>
            [e.name, e.username, e.description]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(needle))
        );
    }, [entries, needle]);

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

    const actions = (entry: VaultEntryRow) => (
        <div className="flex justify-end gap-1">
            <Button
                size="icon-sm"
                variant="ghost"
                disabled={busy === entry.id}
                onClick={() => openEdit(entry)}
                aria-label="Edit entry"
                title="Edit"
            >
                <Pencil className="size-4" />
            </Button>
            <Button
                size="icon-sm"
                variant="ghost"
                disabled={busy === entry.id}
                onClick={() => remove(entry)}
                aria-label="Delete entry"
                title="Delete"
            >
                <Trash2 className="text-destructive size-4" />
            </Button>
        </div>
    );

    return (
        <div className="space-y-4">
            <VaultLock
                unlocked={unlocked}
                expiresAt={unlockExpiresAt}
                promptOpen={promptOpen}
                onPromptOpenChange={setPromptOpen}
                onUnlocked={setUnlockExpiresAt}
                onLocked={onLocked}
            />

            <DataTableCard>
                <DataTableCardHeader
                    title="Secrets"
                    description={`${entries.length} entr${entries.length === 1 ? "y" : "ies"} shared with the whole club`}
                    action={
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                                <Input
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder="Search"
                                    className="h-9 w-40 pl-8"
                                />
                            </div>
                            <Button onClick={openCreate}>
                                <Plus className="size-4" />
                                New entry
                            </Button>
                        </div>
                    }
                />

                {entries.length === 0 ? (
                    <EmptyState
                        className="border-none"
                        icon={KeyRound}
                        title="The vault is empty"
                        description="Add a shared login, API key, or any other club secret."
                    />
                ) : visible.length === 0 ? (
                    <p className="text-muted-foreground p-10 text-center text-sm">
                        Nothing matches &ldquo;{filter.trim()}&rdquo;.
                    </p>
                ) : (
                    // Remounting on lock changes drops any secret cached in a row.
                    <div key={unlocked ? "unlocked" : "locked"}>
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Username</TableHead>
                                        <TableHead>Secret</TableHead>
                                        <TableHead>Added</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.map((e) => (
                                        <TableRow key={e.id}>
                                            <TableCell className="text-foreground font-medium">
                                                <EntryName name={e.name} />
                                                {e.description ? (
                                                    <p className="text-muted-foreground wrap-break-words max-w-[16rem] text-xs font-normal">
                                                        {e.description}
                                                    </p>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-xs">
                                                {e.username ?? "-"}
                                            </TableCell>
                                            <TableCell>
                                                <SecretField
                                                    entryId={e.id}
                                                    unlocked={unlocked}
                                                    onNeedsUnlock={needsUnlock}
                                                />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground whitespace-nowrap">
                                                {formatDate(e.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {actions(e)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="space-y-3 p-4 md:hidden">
                            {visible.map((e) => (
                                <div
                                    key={e.id}
                                    className="border-border space-y-3 rounded-lg border p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-foreground wrap-break-words font-medium">
                                                {e.name}
                                            </p>
                                            {e.username ? (
                                                <p className="text-muted-foreground font-mono text-xs">
                                                    {e.username}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="shrink-0">{actions(e)}</div>
                                    </div>

                                    {e.description ? (
                                        <p className="text-muted-foreground wrap-break-words text-xs">
                                            {e.description}
                                        </p>
                                    ) : null}

                                    <SecretField
                                        entryId={e.id}
                                        unlocked={unlocked}
                                        onNeedsUnlock={needsUnlock}
                                    />

                                    <p className="text-muted-foreground text-xs">
                                        Added {formatDate(e.createdAt)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DataTableCard>

            <VaultEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={editing} />
        </div>
    );
}
