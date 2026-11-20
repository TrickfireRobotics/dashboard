"use client";

import { LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
    LevelSelect,
    LoadState,
    ProviderHeader,
    RemoveButton,
    TableCard,
    TableCardTitle,
} from "@/components/team/team-ui";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export type DashboardMemberRow = {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
};

export type PendingMemberRow = {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
};

type MemberLevel = "active" | "deactivated";

const LEVEL_OPTIONS: { value: MemberLevel; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "deactivated", label: "Deactivated" },
];

function matches(needle: string, ...fields: (string | null | undefined)[]): boolean {
    if (!needle) return true;
    return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function DashboardMembersManager({
    members,
    pending,
    currentUserId,
}: {
    members: DashboardMemberRow[];
    pending: PendingMemberRow[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardMemberRow | null>(null);
    const [memberSearch, setMemberSearch] = useState("");
    const [pendingSearch, setPendingSearch] = useState("");

    async function patchUser(id: string, body: Record<string, unknown>, success: string) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Update failed");
            }
            toast.success(success);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function deleteUser(id: string) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Delete failed");
            }
            toast.success("User deleted");
            setDeleteTarget(null);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    const visibleMembers = useMemo(() => {
        const needle = memberSearch.trim().toLowerCase();
        return members.filter((m) => matches(needle, m.name, m.email));
    }, [members, memberSearch]);

    const visiblePending = useMemo(() => {
        const needle = pendingSearch.trim().toLowerCase();
        return pending.filter((u) => matches(needle, u.name, u.email));
    }, [pending, pendingSearch]);

    return (
        <div className="space-y-4">
            <ProviderHeader
                icon={LayoutDashboard}
                title="TrickFire dashboard"
                stats={[
                    { label: "Members", value: String(members.length) },
                    { label: "Pending", value: String(pending.length) },
                ]}
            />

            {/* Approvals come first: they are the only thing here that needs doing. */}
            {pending.length > 0 ? (
                <TableCard
                    left={<TableCardTitle title="Waiting for approval" count={pending.length} />}
                    search={pendingSearch}
                    onSearchChange={setPendingSearch}
                    searchPlaceholder="Search requests"
                >
                    <LoadState
                        loading={false}
                        empty={visiblePending.length === 0}
                        emptyLabel="Nobody matches that search."
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Registered
                                    </TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visiblePending.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">
                                            {u.name}
                                            <p className="text-muted-foreground text-xs font-normal">
                                                {u.email}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                            {formatDate(u.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <RemoveButton
                                                    label="Reject"
                                                    disabled={busy === u.id}
                                                    onClick={() =>
                                                        patchUser(
                                                            u.id,
                                                            { isActive: false },
                                                            "User rejected"
                                                        )
                                                    }
                                                />
                                                <Button
                                                    size="sm"
                                                    disabled={busy === u.id}
                                                    onClick={() =>
                                                        patchUser(
                                                            u.id,
                                                            { approved: true },
                                                            "User approved"
                                                        )
                                                    }
                                                >
                                                    Approve
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </LoadState>
                </TableCard>
            ) : null}

            <TableCard
                left={<TableCardTitle title="Members" count={members.length} />}
                search={memberSearch}
                onSearchChange={setMemberSearch}
                searchPlaceholder="Search members"
            >
                <LoadState
                    loading={false}
                    empty={visibleMembers.length === 0}
                    emptyLabel={
                        memberSearch.trim()
                            ? "Nobody matches that search."
                            : "No approved members yet."
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Access level</TableHead>
                                <TableHead className="hidden md:table-cell">Joined</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleMembers.map((m) => {
                                const isSelf = m.id === currentUserId;
                                return (
                                    <TableRow key={m.id}>
                                        <TableCell className="font-medium">
                                            {m.name}
                                            {isSelf ? (
                                                <span className="text-muted-foreground ml-2 text-xs font-normal">
                                                    (you)
                                                </span>
                                            ) : null}
                                            <p className="text-muted-foreground text-xs font-normal">
                                                {m.email}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <LevelSelect<MemberLevel>
                                                value={m.isActive ? "active" : "deactivated"}
                                                options={LEVEL_OPTIONS}
                                                disabled={isSelf || busy === m.id}
                                                tone={m.isActive ? "default" : "danger"}
                                                onChange={(level) =>
                                                    patchUser(
                                                        m.id,
                                                        { isActive: level === "active" },
                                                        level === "active"
                                                            ? `${m.name} reactivated`
                                                            : `${m.name} deactivated`
                                                    )
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                            {formatDate(m.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {m.isActive ? (
                                                <span className="text-muted-foreground text-xs">
                                                    -
                                                </span>
                                            ) : (
                                                <RemoveButton
                                                    label="Delete"
                                                    disabled={isSelf || busy === m.id}
                                                    onClick={() => setDeleteTarget(m)}
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </LoadState>
            </TableCard>

            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent overlayClassName="bg-destructive/20">
                    <DialogHeader>
                        <DialogTitle>Permanently delete this user?</DialogTitle>
                        <DialogDescription>
                            This will permanently remove <strong>{deleteTarget?.name}</strong> (
                            {deleteTarget?.email}) and all of their associated data. This cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy === deleteTarget?.id}
                            onClick={() => deleteTarget && deleteUser(deleteTarget.id)}
                        >
                            Delete permanently
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
