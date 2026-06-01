"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { OnshapeCompany, OnshapeMember, OnshapeTeam, OnshapeTeamMember } from "@/lib/onshape";
import { formatDate } from "@/lib/utils";

type Tab = "members" | "teams";

function MemberTypeBadges({
    admin,
    guest,
    light,
}: {
    admin: boolean;
    guest: boolean;
    light: boolean;
}) {
    if (!admin && !guest && !light) return <Badge variant="secondary">Member</Badge>;
    return (
        <div className="flex flex-wrap gap-1">
            {admin && <Badge>Admin</Badge>}
            {guest && <Badge variant="outline">Guest</Badge>}
            {light && <Badge variant="outline">Light</Badge>}
        </div>
    );
}

function MembersTab() {
    const [members, setMembers] = useState<OnshapeMember[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"member" | "admin" | "light" | "guest">("member");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/onshape/members", { cache: "no-store" });
            if (res.ok) setMembers((await res.json()).members ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function addMember() {
        if (!email.trim()) {
            toast.error("Enter an email");
            return;
        }
        setAdding(true);
        try {
            const res = await fetch("/api/admin/onshape/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    admin: role === "admin",
                    guest: role === "guest",
                    light: role === "light",
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to add member");
            }
            toast.success("Member invited");
            setEmail("");
            setRole("member");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setAdding(false);
        }
    }

    async function removeMember(member: OnshapeMember) {
        if (!member.userId) {
            toast.error("Cannot resolve this member's user id");
            return;
        }
        if (!confirm(`Remove ${member.name} from the company?`)) return;
        setBusy(member.userId);
        try {
            const res = await fetch(`/api/admin/onshape/members/${member.userId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to remove member");
            toast.success("Member removed");
            load();
        } catch {
            toast.error("Failed to remove member");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Invite member</CardTitle>
                    <CardDescription>
                        Add a user to the Onshape company by email. They&apos;ll receive an
                        invitation from Onshape.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-56 flex-1 space-y-2">
                            <Label htmlFor="onshape-email">Email</Label>
                            <Input
                                id="onshape-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="member@example.com"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") addMember();
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="onshape-role">Type</Label>
                            <select
                                id="onshape-role"
                                value={role}
                                onChange={(e) => setRole(e.target.value as typeof role)}
                                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                            >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                                <option value="light">Light user</option>
                                <option value="guest">Guest</option>
                            </select>
                        </div>
                        <Button onClick={addMember} disabled={adding}>
                            {adding ? "Inviting…" : "Invite"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : !members || members.length === 0 ? (
                <p className="text-muted-foreground text-sm">No company members found.</p>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Added</TableHead>
                                <TableHead>Last login</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((m, i) => (
                                <TableRow key={m.userId ?? `${m.name}-${i}`}>
                                    <TableCell className="font-medium">{m.name}</TableCell>
                                    <TableCell>
                                        <MemberTypeBadges
                                            admin={m.admin}
                                            guest={m.guest}
                                            light={m.light}
                                        />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {m.dateAdded ? formatDate(new Date(m.dateAdded)) : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {m.lastLoginTime
                                            ? formatDate(new Date(m.lastLoginTime))
                                            : "Never"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={!m.userId || busy === m.userId}
                                            onClick={() => removeMember(m)}
                                        >
                                            Remove
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

function TeamsTab() {
    const [teams, setTeams] = useState<OnshapeTeam[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<OnshapeTeam | null>(null);
    const [teamMembers, setTeamMembers] = useState<OnshapeTeamMember[] | null>(null);
    const [membersLoading, setMembersLoading] = useState(false);

    useEffect(() => {
        fetch("/api/admin/onshape/teams", { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setTeams(d.teams ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    async function viewMembers(team: OnshapeTeam) {
        setSelected(team);
        setTeamMembers(null);
        setMembersLoading(true);
        try {
            const res = await fetch(`/api/admin/onshape/teams/${team.id}/members`, {
                cache: "no-store",
            });
            if (res.ok) setTeamMembers((await res.json()).members ?? []);
        } finally {
            setMembersLoading(false);
        }
    }

    if (loading)
        return (
            <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
            </div>
        );
    if (!teams || teams.length === 0)
        return <p className="text-muted-foreground text-sm">No teams found.</p>;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Members</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teams.map((t) => (
                            <TableRow
                                key={t.id}
                                className={
                                    selected?.id === t.id ? "bg-sidebar-accent/40" : undefined
                                }
                            >
                                <TableCell>
                                    <p className="font-medium">{t.name}</p>
                                    {t.description && (
                                        <p className="text-muted-foreground text-xs">
                                            {t.description}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => viewMembers(t)}
                                    >
                                        View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="border-border rounded-lg border p-4">
                {!selected ? (
                    <p className="text-muted-foreground text-sm">
                        Select a team to view its members.
                    </p>
                ) : membersLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-8" />
                        <Skeleton className="h-8" />
                    </div>
                ) : !teamMembers || teamMembers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No members in {selected.name}.</p>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm font-medium">{selected.name}</p>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teamMembers.map((m, i) => (
                                    <TableRow key={m.userId ?? `${m.name}-${i}`}>
                                        <TableCell className="font-medium">{m.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={m.admin ? "default" : "secondary"}>
                                                {m.admin ? "Team admin" : "Member"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}

export function AdminOnshapeManager({ company }: { company: OnshapeCompany | null }) {
    const [tab, setTab] = useState<Tab>("members");

    return (
        <div className="space-y-4">
            {company && (
                <Card>
                    <CardHeader>
                        <CardTitle>{company.name}</CardTitle>
                        <CardDescription>
                            Company ID <span className="font-mono">{company.id}</span>
                            {company.admin ? " · API key has admin access" : ""}
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            <p className="text-muted-foreground text-xs">
                Onshape&apos;s API exposes member type (admin/guest/light) and team membership, but
                has no read endpoint for individual global-permission grants or Enterprise project
                roles — manage those in the Onshape admin console.
            </p>

            <div className="flex flex-wrap gap-1 border-b pb-3">
                <TabButton active={tab === "members"} onClick={() => setTab("members")}>
                    Members
                </TabButton>
                <TabButton active={tab === "teams"} onClick={() => setTab("teams")}>
                    Teams
                </TabButton>
            </div>

            {tab === "members" && <MembersTab />}
            {tab === "teams" && <TeamsTab />}
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}
