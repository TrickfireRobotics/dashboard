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
import type {
    GithubInvitation,
    GithubMember,
    GithubOrg,
    GithubTeam,
    GithubTeamMember,
} from "@/lib/integrations/github";
import { usePoll } from "@/lib/use-poll";
import { formatDate } from "@/lib/utils";

type Tab = "members" | "invitations" | "teams";

function MembersTab() {
    const [members, setMembers] = useState<GithubMember[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [invitee, setInvitee] = useState("");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/admin/github/members", { cache: "no-store" });
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
        const value = invitee.trim();
        if (!value) {
            toast.error("Enter a username or email");
            return;
        }
        setAdding(true);
        try {
            // An "@" means an email address; otherwise treat it as a username.
            const res = await fetch("/api/admin/github/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(value.includes("@") ? { email: value } : { username: value }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to invite member");
            }
            toast.success("Invitation sent");
            setInvitee("");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setAdding(false);
        }
    }

    async function removeMember(member: GithubMember) {
        if (!confirm(`Remove ${member.login} from the organization?`)) return;
        setBusy(member.login);
        try {
            const res = await fetch(`/api/admin/github/members/${member.login}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to remove member");
            }
            toast.success("Member removed");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to remove member");
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
                        Add a user to the organization by GitHub username or email. They&apos;ll
                        receive an invitation and join as a regular member.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-56 flex-1 space-y-2">
                            <Label htmlFor="github-invitee">Username or email</Label>
                            <Input
                                id="github-invitee"
                                value={invitee}
                                onChange={(e) => setInvitee(e.target.value)}
                                placeholder="octocat or member@example.com"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") addMember();
                                }}
                            />
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
                <p className="text-muted-foreground text-sm">No organization members found.</p>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((m) => (
                                <TableRow key={m.id}>
                                    <TableCell className="font-medium">
                                        <a
                                            href={m.htmlUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline"
                                        >
                                            {m.login}
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={m.role === "admin" ? "default" : "secondary"}
                                        >
                                            {m.role === "admin" ? "Owner" : "Member"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={busy === m.login}
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

function InvitationsTab() {
    const [invitations, setInvitations] = useState<GithubInvitation[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<number | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/admin/github/invitations", { cache: "no-store" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error ?? "Failed to load invitations");
                return;
            }
            setInvitations(data?.invitations ?? []);
        } catch {
            setError("Failed to load invitations");
        } finally {
            setLoading(false);
        }
    }, []);

    usePoll(load);

    async function cancel(id: number) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/github/invitations/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to cancel invitation");
            }
            toast.success("Invitation cancelled");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to cancel invitation");
        } finally {
            setBusy(null);
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
    if (!invitations || invitations.length === 0)
        return <p className="text-muted-foreground text-sm">No pending invitations.</p>;

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Invitee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden md:table-cell">Invited by</TableHead>
                        <TableHead className="hidden md:table-cell">Sent</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invitations.map((i) => (
                        <TableRow key={i.id}>
                            <TableCell className="font-medium">
                                {i.login ?? i.email ?? "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{i.role}</TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">
                                {i.inviter ?? "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden md:table-cell">
                                {i.createdAt ? formatDate(new Date(i.createdAt)) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={busy === i.id}
                                    onClick={() => cancel(i.id)}
                                >
                                    Cancel
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function TeamsTab() {
    const [teams, setTeams] = useState<GithubTeam[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<GithubTeam | null>(null);
    const [teamMembers, setTeamMembers] = useState<GithubTeamMember[] | null>(null);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [membersLoading, setMembersLoading] = useState(false);

    useEffect(() => {
        fetch("/api/admin/github/teams", { cache: "no-store" })
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

    async function viewMembers(team: GithubTeam) {
        setSelected(team);
        setTeamMembers(null);
        setMembersError(null);
        setMembersLoading(true);
        try {
            const res = await fetch(`/api/admin/github/teams/${team.slug}/members`, {
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
                                    <TableHead>Username</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teamMembers.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell className="font-medium">{m.login}</TableCell>
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

export function AdminGithubManager({ org }: { org: GithubOrg | null }) {
    const [tab, setTab] = useState<Tab>("members");

    return (
        <div className="space-y-4">
            {org && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <a
                                href={org.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline"
                            >
                                {org.name ?? org.login}
                            </a>
                        </CardTitle>
                        <CardDescription>
                            <span className="font-mono">@{org.login}</span>
                            {org.memberCount !== null ? ` · ${org.memberCount} members` : ""}
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            <p className="text-muted-foreground text-xs">
                Invitations are sent as regular members only. Owner promotion and demotion are not
                available here - manage owners in the GitHub organization settings.
            </p>

            <div className="flex flex-wrap gap-1 border-b pb-3">
                <TabButton active={tab === "members"} onClick={() => setTab("members")}>
                    Members
                </TabButton>
                <TabButton active={tab === "invitations"} onClick={() => setTab("invitations")}>
                    Invitations
                </TabButton>
                <TabButton active={tab === "teams"} onClick={() => setTab("teams")}>
                    Teams
                </TabButton>
            </div>

            {tab === "members" && <MembersTab />}
            {tab === "invitations" && <InvitationsTab />}
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
