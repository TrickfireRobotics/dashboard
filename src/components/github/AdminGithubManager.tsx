"use client";

import { GitBranch, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
    AddPersonBar,
    LevelSelect,
    LoadState,
    ProviderHeader,
    RemoveButton,
    SubTabPanel,
    SubTabs,
    TeamsBrowser,
    TeamsBrowserHint,
    type TeamGroup,
} from "@/components/team/team-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    GithubRole,
    GithubTeam,
    GithubTeamMember,
} from "@/lib/integrations/github";
import { usePoll } from "@/lib/use-poll";
import { formatDate } from "@/lib/utils";

const ROLE_OPTIONS: { value: GithubRole; label: string }[] = [
    { value: "member", label: "Member" },
    { value: "admin", label: "Owner" },
];

/** Owners first (alphabetically), then everyone else - one table, two groups. */
function sortMembers(members: GithubMember[]): GithubMember[] {
    return [...members].sort((a, b) => {
        if ((a.role === "admin") !== (b.role === "admin")) return a.role === "admin" ? -1 : 1;
        return a.login.localeCompare(b.login);
    });
}

function PeopleTab({ onCounts }: { onCounts: (counts: { members: number }) => void }) {
    const [members, setMembers] = useState<GithubMember[] | null>(null);
    const [invitations, setInvitations] = useState<GithubInvitation[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [invitee, setInvitee] = useState("");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setError(null);
        try {
            // Pending invitations live in the same list as members: they are
            // people on their way in, not a separate category.
            const [membersRes, invitesRes] = await Promise.all([
                fetch("/api/admin/github/members", { cache: "no-store" }),
                fetch("/api/admin/github/invitations", { cache: "no-store" }),
            ]);
            const membersData = await membersRes.json().catch(() => null);
            if (!membersRes.ok) {
                setError(membersData?.error ?? "Failed to load members");
                return;
            }
            setMembers(membersData?.members ?? []);
            onCounts({ members: membersData?.members?.length ?? 0 });

            const invitesData = await invitesRes.json().catch(() => null);
            setInvitations(invitesRes.ok ? (invitesData?.invitations ?? []) : []);
        } catch {
            setError("Failed to load members");
        } finally {
            setLoading(false);
        }
    }, [onCounts]);

    usePoll(load);

    async function invite() {
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

    async function changeRole(member: GithubMember, role: GithubRole) {
        if (role === "admin" && !confirm(`Make ${member.login} an owner of the organization?`)) {
            return;
        }
        setBusy(member.login);
        try {
            const res = await fetch(`/api/admin/github/members/${member.login}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to update role");
            }
            toast.success(`${member.login} is now ${role === "admin" ? "an owner" : "a member"}`);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update role");
        } finally {
            setBusy(null);
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

    async function cancelInvitation(invitation: GithubInvitation) {
        setBusy(`invite-${invitation.id}`);
        try {
            const res = await fetch(`/api/admin/github/invitations/${invitation.id}`, {
                method: "DELETE",
            });
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

    return (
        <>
            <AddPersonBar hint="People join as regular members. Promote them to owner from the list below.">
                <div className="min-w-56 flex-1 space-y-2">
                    <Label htmlFor="github-invitee">GitHub username or email</Label>
                    <Input
                        id="github-invitee"
                        value={invitee}
                        onChange={(e) => setInvitee(e.target.value)}
                        placeholder="octocat or member@example.com"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") invite();
                        }}
                    />
                </div>
                <Button onClick={invite} disabled={adding}>
                    {adding ? "Inviting…" : "Invite"}
                </Button>
            </AddPersonBar>

            <LoadState
                loading={loading}
                error={error}
                empty={(members?.length ?? 0) === 0 && invitations.length === 0}
                emptyLabel="No organization members found."
            >
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Access level</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortMembers(members ?? []).map((m) => (
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
                                        <LevelSelect
                                            value={m.role}
                                            options={ROLE_OPTIONS}
                                            disabled={busy === m.login}
                                            tone={m.role === "admin" ? "elevated" : "default"}
                                            onChange={(role) => changeRole(m, role)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <RemoveButton
                                            disabled={busy === m.login}
                                            onClick={() => removeMember(m)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}

                            {invitations.map((i) => (
                                <TableRow key={`invite-${i.id}`} className="bg-muted/20">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {i.login ?? i.email ?? "-"}
                                            <Badge variant="outline">Pending invite</Badge>
                                        </div>
                                        <p className="text-muted-foreground text-xs font-normal">
                                            Sent{" "}
                                            {i.createdAt ? formatDate(new Date(i.createdAt)) : "-"}
                                            {i.inviter ? ` by ${i.inviter}` : ""}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {i.role === "admin" ? "Owner" : "Member"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <RemoveButton
                                            label="Cancel"
                                            disabled={busy === `invite-${i.id}`}
                                            onClick={() => cancelInvitation(i)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </LoadState>
        </>
    );
}

function TeamsTab({ onCounts }: { onCounts: (counts: { teams: number }) => void }) {
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
                onCounts({ teams: data?.teams?.length ?? 0 });
            })
            .catch(() => setError("Failed to load teams"))
            .finally(() => setLoading(false));
    }, [onCounts]);

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

    const groups: TeamGroup[] = (teams ?? []).map((t) => ({
        key: t.slug,
        name: t.name,
        description: t.description,
    }));

    return (
        <TeamsBrowser
            groups={groups}
            loading={loading}
            error={error}
            selectedKey={selected?.slug ?? null}
            onSelect={(group) => {
                const team = teams?.find((t) => t.slug === group.key);
                if (team) viewMembers(team);
            }}
            detail={
                !selected ? (
                    <TeamsBrowserHint>Pick a team to see who is in it.</TeamsBrowserHint>
                ) : (
                    <div className="p-4">
                        <p className="mb-3 text-sm font-medium">{selected.name}</p>
                        <LoadState
                            loading={membersLoading}
                            error={membersError}
                            empty={(teamMembers?.length ?? 0) === 0}
                            emptyLabel={`No members in ${selected.name}.`}
                            rows={2}
                        >
                            <ul className="divide-border divide-y text-sm">
                                {(teamMembers ?? []).map((m) => (
                                    <li key={m.id} className="py-2 font-medium">
                                        {m.login}
                                    </li>
                                ))}
                            </ul>
                        </LoadState>
                    </div>
                )
            }
        />
    );
}

export function AdminGithubManager({ org }: { org: GithubOrg | null }) {
    const [tab, setTab] = useState("people");
    const [counts, setCounts] = useState<{ members?: number; teams?: number }>({});

    const onPeopleCounts = useCallback(
        (next: { members: number }) => setCounts((c) => ({ ...c, members: next.members })),
        []
    );
    const onTeamCounts = useCallback(
        (next: { teams: number }) => setCounts((c) => ({ ...c, teams: next.teams })),
        []
    );

    return (
        <div className="space-y-4">
            <ProviderHeader
                icon={GitBranch}
                title={org?.name ?? org?.login ?? "GitHub organization"}
                href={org?.htmlUrl}
                subtitle={org ? `@${org.login}` : undefined}
                stats={[
                    {
                        label: "Members",
                        value: String(counts.members ?? org?.memberCount ?? "-"),
                    },
                    { label: "Teams", value: String(counts.teams ?? "-") },
                ]}
                note="Owners can do anything in the org, including deleting it. GitHub only accepts a role change if the dashboard's token belongs to an org owner."
            />

            <SubTabs
                value={tab}
                onValueChange={setTab}
                tabs={[
                    { value: "people", label: "People", icon: Users },
                    { value: "teams", label: "Teams", icon: GitBranch },
                ]}
            >
                <SubTabPanel value="people">
                    <PeopleTab onCounts={onPeopleCounts} />
                </SubTabPanel>
                <SubTabPanel value="teams">
                    <TeamsTab onCounts={onTeamCounts} />
                </SubTabPanel>
            </SubTabs>
        </div>
    );
}
