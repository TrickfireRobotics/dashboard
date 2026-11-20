"use client";

import { Gamepad2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

export type AdminWhitelistRow = {
    id: number;
    username: string;
    addedByName: string | null;
    createdAt: Date;
};

export function WhitelistManager({ entries }: { entries: AdminWhitelistRow[] }) {
    const router = useRouter();
    const [removing, setRemoving] = useState<number | null>(null);
    const [username, setUsername] = useState("");
    const [adding, setAdding] = useState(false);

    async function add() {
        const trimmed = username.trim();
        if (!trimmed) return;
        setAdding(true);
        try {
            const res = await fetch("/api/admin/whitelist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: trimmed }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to add");
            }
            toast.success(`${trimmed} whitelisted`);
            setUsername("");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setAdding(false);
        }
    }

    async function remove(id: number) {
        setRemoving(id);
        try {
            const res = await fetch(`/api/admin/whitelist/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to remove");
            }
            toast.success("Removed from whitelist");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setRemoving(null);
        }
    }

    return (
        <div className="space-y-4">
            <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-lg border p-4">
                <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") add();
                    }}
                    placeholder="Minecraft username"
                    className="max-w-64 flex-1"
                />
                <Button size="sm" disabled={adding || !username.trim()} onClick={add}>
                    <Plus className="size-4" />
                    {adding ? "Adding..." : "Add to whitelist"}
                </Button>
            </div>

            {entries.length === 0 ? (
                <EmptyState
                    icon={Gamepad2}
                    title="No one is whitelisted yet"
                    description="Add a Minecraft username above to get started."
                />
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead className="hidden md:table-cell">Added by</TableHead>
                                <TableHead className="hidden md:table-cell">Added on</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((e) => (
                                <TableRow key={e.id}>
                                    <TableCell className="text-foreground font-medium">
                                        {e.username}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {e.addedByName ?? "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                        {formatDate(e.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={removing === e.id}
                                            onClick={() => remove(e.id)}
                                        >
                                            {removing === e.id ? "Removing..." : "Remove"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
