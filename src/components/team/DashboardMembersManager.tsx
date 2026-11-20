"use client";

import { ShieldCheck, UserCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
    LevelSelect,
    LoadState,
    ProviderHeader,
    RemoveButton,
    SubTabPanel,
    SubTabs,
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
    const [tab, setTab] = useState("people");
    const [busy, setBusy] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardMemberRow | null>(null);

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

    const activeCount = members.filter((m) => m.isActive).length;

    return (
        <div className="space-y-4">
            <ProviderHeader
                icon={ShieldCheck}
                title="TrickFire dashboard"
                subtitle="Accounts that can sign in to this dashboard"
                stats={[
                    { label: "Active", value: String(activeCount) },
                    { label: "Deactivated", value: String(members.length - activeCount) },
                    { label: "Pending", value: String(pending.length) },
                ]}
                note="A deactivated account keeps its data but can no longer sign in. Deleting is permanent."
            />

            <SubTabs
                value={tab}
                onValueChange={setTab}
                tabs={[
                    { value: "people", label: "People", icon: Users },
                    {
                        value: "pending",
                        label: "Pending",
                        icon: UserCheck,
                        badge: pending.length,
                    },
                ]}
            >
                <SubTabPanel value="people">
                    <LoadState
                        loading={false}
                        empty={members.length === 0}
                        emptyLabel="No approved members yet."
                    >
                        <div className="border-border rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Access level</TableHead>
                                        <TableHead className="hidden md:table-cell">
                                            Joined
                                        </TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {members.map((m) => {
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
                                                        value={
                                                            m.isActive ? "active" : "deactivated"
                                                        }
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
                        </div>
                    </LoadState>
                </SubTabPanel>

                <SubTabPanel value="pending">
                    <LoadState
                        loading={false}
                        empty={pending.length === 0}
                        emptyLabel="Nobody is waiting for approval."
                    >
                        <div className="border-border rounded-lg border">
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
                                    {pending.map((u) => (
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
                        </div>
                    </LoadState>
                </SubTabPanel>
            </SubTabs>

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
