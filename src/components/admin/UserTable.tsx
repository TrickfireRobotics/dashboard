"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { formatDate } from "@/lib/utils";

export type AdminUserRow = {
    id: string;
    name: string;
    email: string;
    role: "member" | "admin";
    isActive: boolean;
    grantedFeatures: FeatureKey[];
    createdAt: Date;
};

const ROLE_ITEMS = { member: "Member", admin: "Admin" };
const ALL_FEATURES = Object.keys(FEATURES) as FeatureKey[];

export function UserTable({
    users,
    currentUserId,
}: {
    users: AdminUserRow[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    async function patchUser(id: string, body: Record<string, unknown>) {
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
            toast.success("User updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function toggleFeature(userId: string, featureKey: FeatureKey, granted: boolean) {
        setBusy(`${userId}-${featureKey}`);
        try {
            if (granted) {
                const res = await fetch(`/api/admin/users/${userId}/features`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ featureKey }),
                });
                if (!res.ok) throw new Error("Failed to revoke");
                toast.success("Feature revoked");
            } else {
                const res = await fetch(`/api/admin/users/${userId}/features`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ featureKey }),
                });
                if (!res.ok) throw new Error("Failed to grant");
                toast.success("Feature granted");
            }
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((u) => {
                        const isSelf = u.id === currentUserId;
                        const isExpanded = expanded === u.id;
                        return (
                            <Fragment key={u.id}>
                                <TableRow>
                                    <TableCell className="text-foreground font-medium">
                                        {u.name}
                                        {isSelf ? (
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                (you)
                                            </span>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {u.email}
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            items={ROLE_ITEMS}
                                            value={u.role}
                                            onValueChange={(value) =>
                                                patchUser(u.id, { role: value })
                                            }
                                            disabled={isSelf || busy === u.id}
                                        >
                                            <SelectTrigger size="sm" className="w-28">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="member">Member</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        {u.isActive ? (
                                            <Badge variant="default">Active</Badge>
                                        ) : (
                                            <Badge variant="destructive">Deactivated</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(u.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {u.role !== "admin" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setExpanded(isExpanded ? null : u.id)
                                                    }
                                                >
                                                    Features
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant={u.isActive ? "destructive" : "outline"}
                                                disabled={isSelf || busy === u.id}
                                                onClick={() =>
                                                    patchUser(u.id, { isActive: !u.isActive })
                                                }
                                            >
                                                {u.isActive ? "Deactivate" : "Activate"}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && u.role !== "admin" && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="bg-muted/30 px-6 py-3">
                                            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                                                Feature access for {u.name}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {ALL_FEATURES.map((key) => {
                                                    const granted = u.grantedFeatures.includes(key);
                                                    const busyKey = `${u.id}-${key}`;
                                                    return (
                                                        <Button
                                                            key={key}
                                                            size="sm"
                                                            variant={
                                                                granted ? "default" : "outline"
                                                            }
                                                            disabled={busy === busyKey}
                                                            onClick={() =>
                                                                toggleFeature(u.id, key, granted)
                                                            }
                                                        >
                                                            {FEATURES[key].label}
                                                            {granted ? " ✓" : ""}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
