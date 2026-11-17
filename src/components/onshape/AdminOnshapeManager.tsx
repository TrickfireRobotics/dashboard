"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type {
    OnshapeCompany,
    OnshapeMember,
    OnshapeTeam,
    OnshapeTeamMember,
} from "@/lib/integrations/onshape";
import { usePoll } from "@/lib/use-poll";
import { formatDate } from "@/lib/utils";

type Tab = "members" | "teams";
type MemberRole = "member" | "admin" | "light" | "guest";

function roleOf(m: { admin: boolean; guest: boolean; light: boolean }): MemberRole {
    if (m.admin) return "admin";
    if (m.light) return "light";
    if (m.guest) return "guest";
    return "member";
}

function roleToFlags(role: MemberRole): { admin: boolean; guest: boolean; light: boolean } {
    return {
        admin: role === "admin",
        guest: role === "guest",
        light: role === "light",
    };
}

function roleSelectClassName(role: MemberRole): string {
    switch (role) {
        case "admin":
            return "border-primary/30 bg-primary/10 text-primary font-medium";
        case "guest":
        case "light":
            return "bg-muted-foreground/10";
        default:
            return "";
    }
}

/** Admins first (alphabetically), then everyone else (alphabetically) - one table, two visual groups. */
function sortMembers(members: OnshapeMember[]): OnshapeMember[] {
    return [...members].sort((a, b) => {
        if (a.admin !== b.admin) return a.admin ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

function MembersTab() {
    const [members, setMembers] = useState<OnshapeMember[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"member" | "admin" | "light" | "guest">("member");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/admin/onshape/members", { cache: "no-store" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error ?? "Failed to load members");
                return;
            }
            setMembers(data?.members ?? []);
        } catch {
            setError("Failed to load members");
        } finally {
            setLoading(false);
        }
    }, []);

    usePoll(load);

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

    async function changeRole(member: OnshapeMember, role: MemberRole) {
        if (!member.userId || !member.email) {
            toast.error("Cannot resolve this member's id or email");
            return;
        }
        setBusy(member.userId);
        try {
            const res = await fetch(`/api/admin/onshape/members/${member.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: member.email, ...roleToFlags(role) }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to update role");
            }
            toast.success(`${member.name} is now ${role}`);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update role");
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
                            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                                <SelectTrigger id="onshape-role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="light">Light user</SelectItem>
                                    <SelectItem value="guest">Guest</SelectItem>
                                </SelectContent>
                            </Select>
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
            ) : error ? (
                <p className="text-destructive text-sm">{error}</p>
            ) : !members || members.length === 0 ? (
                <p className="text-muted-foreground text-sm">No company members found.</p>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="hidden md:table-cell">Added</TableHead>
                                <TableHead className="hidden md:table-cell">Last login</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortMembers(members).map((m, i) => (
                                <TableRow key={m.userId ?? `${m.name}-${i}`}>
                                    <TableCell className="font-medium">{m.name}</TableCell>
                                    <TableCell>
                                        <Select
                                            value={roleOf(m)}
                                            disabled={!m.userId || !m.email || busy === m.userId}
                                            onValueChange={(v) => changeRole(m, v as MemberRole)}
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                className={roleSelectClassName(roleOf(m))}
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="member">Member</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="light">Light user</SelectItem>
                                                <SelectItem value="guest">Guest</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                        {m.dateAdded ? formatDate(new Date(m.dateAdded)) : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
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
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<OnshapeTeam | null>(null);
    const [teamMembers, setTeamMembers] = useState<OnshapeTeamMember[] | null>(null);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [membersLoading, setMembersLoading] = useState(false);

    useEffect(() => {
        fetch("/api/admin/onshape/teams", { cache: "no-store" })
            .then(async (r) => {
                const data = await r.json().catch(() => null);
                if (!r.ok) {
                    setError(data?.error ?? "Failed to load teams");
                    return;
                }
                setTeams(data?.teams ?? []);
            })
            .catch(() => setError("Failed to load teams"))
            .finally(() => setLoading(false));
    }, []);

    async function viewMembers(team: OnshapeTeam) {
        setSelected(team);
        setTeamMembers(null);
        setMembersError(null);
        setMembersLoading(true);
        try {
            const res = await fetch(`/api/admin/onshape/teams/${team.id}/members`, {
                cache: "no-store",
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMembersError(data?.error ?? "Failed to load members");
                return;
            }
            setTeamMembers(data?.members ?? []);
        } catch {
            setMembersError("Failed to load members");
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
    if (error) return <p className="text-destructive text-sm">{error}</p>;
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
                ) : membersError ? (
                    <p className="text-destructive text-sm">{membersError}</p>
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
                Member type (Admin/Guest/Light) can be changed here at any time. Individual global
                permissions, Enterprise project roles, and per-team admin status for existing team
                members aren&apos;t exposed by Onshape&apos;s API - manage those in the Onshape
                admin console.
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
