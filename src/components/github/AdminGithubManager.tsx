"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GithubIcon } from "@/components/icons/brand-icons";
import {
    InviteCard,
    LevelSelect,
    LoadState,
    ProviderHeader,
    RemoveButton,
    SubTabsList,
    TableCard,
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
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

function InviteForm({ onInvited }: { onInvited: () => void }) {
    const [invitee, setInvitee] = useState("");
    const [adding, setAdding] = useState(false);

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
            onInvited();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setAdding(false);
        }
    }

    return (
        <InviteCard title="Invite to the organization">
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
        </InviteCard>
    );
}

function PeopleTable({
    members,
    invitations,
    loading,
    error,
    search,
    reload,
}: {
    members: GithubMember[];
    invitations: GithubInvitation[];
    loading: boolean;
    error: string | null;
    search: string;
    reload: () => void;
}) {
    const [busy, setBusy] = useState<string | null>(null);

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
            reload();
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
            reload();
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
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to cancel invitation");
        } finally {
            setBusy(null);
        }
    }

    const needle = search.trim().toLowerCase();
    const visibleMembers = useMemo(
        () => sortMembers(members).filter((m) => !needle || m.login.toLowerCase().includes(needle)),
        [members, needle]
    );
    const visibleInvitations = useMemo(
        () =>
            invitations.filter(
                (i) =>
                    !needle ||
                    [i.login, i.email].some((field) => field?.toLowerCase().includes(needle))
            ),
        [invitations, needle]
    );

    return (
        <LoadState
            loading={loading}
            error={error}
            empty={visibleMembers.length === 0 && visibleInvitations.length === 0}
            emptyLabel={needle ? "Nobody matches that search." : "No organization members found."}
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Access level</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleMembers.map((m) => (
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

                    {visibleInvitations.map((i) => (
                        <TableRow key={`invite-${i.id}`} className="bg-muted/20">
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {i.login ?? i.email ?? "-"}
                                    <Badge variant="outline">Pending invite</Badge>
                                </div>
                                <p className="text-muted-foreground text-xs font-normal">
                                    Sent {i.createdAt ? formatDate(new Date(i.createdAt)) : "-"}
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
        </LoadState>
    );
}

function TeamsPanel({
    teams,
    loading,
    error,
    search,
}: {
    teams: GithubTeam[];
    loading: boolean;
    error: string | null;
    search: string;
}) {
    const [selected, setSelected] = useState<GithubTeam | null>(null);
    const [teamMembers, setTeamMembers] = useState<GithubTeamMember[] | null>(null);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [membersLoading, setMembersLoading] = useState(false);

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

    const needle = search.trim().toLowerCase();
    const groups: TeamGroup[] = teams
        .filter(
            (t) =>
                !needle ||
                [t.name, t.description].some((field) => field?.toLowerCase().includes(needle))
        )
        .map((t) => ({ key: t.slug, name: t.name, description: t.description }));

    return (
        <TeamsBrowser
            groups={groups}
            loading={loading}
            error={error}
            selectedKey={selected?.slug ?? null}
            onSelect={(group) => {
                const team = teams.find((t) => t.slug === group.key);
                if (team) viewMembers(team);
            }}
            emptyLabel={needle ? "No teams match that search." : "No teams found."}
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
    const [search, setSearch] = useState("");

    const [members, setMembers] = useState<GithubMember[]>([]);
    const [invitations, setInvitations] = useState<GithubInvitation[]>([]);
    const [peopleLoading, setPeopleLoading] = useState(true);
    const [peopleError, setPeopleError] = useState<string | null>(null);

    const [teams, setTeams] = useState<GithubTeam[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [teamsError, setTeamsError] = useState<string | null>(null);

    const loadPeople = useCallback(async () => {
        setPeopleError(null);
        try {
            // Pending invitations live in the same list as members: they are
            // people on their way in, not a separate category.
            const [membersRes, invitesRes] = await Promise.all([
                fetch("/api/admin/github/members", { cache: "no-store" }),
                fetch("/api/admin/github/invitations", { cache: "no-store" }),
            ]);
            const membersData = await membersRes.json().catch(() => null);
            if (!membersRes.ok) {
                setPeopleError(membersData?.error ?? "Failed to load members");
                return;
            }
            setMembers(membersData?.members ?? []);

            const invitesData = await invitesRes.json().catch(() => null);
            setInvitations(invitesRes.ok ? (invitesData?.invitations ?? []) : []);
        } catch {
            setPeopleError("Failed to load members");
        } finally {
            setPeopleLoading(false);
        }
    }, []);

    usePoll(loadPeople);

    useEffect(() => {
        fetch("/api/admin/github/teams", { cache: "no-store" })
            .then(async (r) => {
                const data = await r.json().catch(() => null);
                if (!r.ok) {
                    setTeamsError(data?.error ?? "Failed to load teams");
                    return;
                }
                setTeams(data?.teams ?? []);
            })
            .catch(() => setTeamsError("Failed to load teams"))
            .finally(() => setTeamsLoading(false));
    }, []);

    return (
        <div className="space-y-4">
            <ProviderHeader
                icon={GithubIcon}
                title={org?.name ?? org?.login ?? "GitHub organization"}
                href={org?.htmlUrl}
                stats={[
                    {
                        label: "Members",
                        value: String(peopleLoading ? (org?.memberCount ?? "-") : members.length),
                    },
                    { label: "Teams", value: teamsLoading ? "-" : String(teams.length) },
                ]}
            />

            {tab === "people" ? <InviteForm onInvited={loadPeople} /> : null}

            <Tabs
                value={tab}
                onValueChange={(next) => {
                    setTab(next as string);
                    setSearch("");
                }}
            >
                <TableCard
                    left={
                        <SubTabsList
                            tabs={[
                                { value: "people", label: "People" },
                                { value: "teams", label: "Teams" },
                            ]}
                        />
                    }
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder={tab === "people" ? "Search people" : "Search teams"}
                >
                    <TabsContent value="people">
                        <PeopleTable
                            members={members}
                            invitations={invitations}
                            loading={peopleLoading}
                            error={peopleError}
                            search={search}
                            reload={loadPeople}
                        />
                    </TabsContent>
                    <TabsContent value="teams">
                        <TeamsPanel
                            teams={teams}
                            loading={teamsLoading}
                            error={teamsError}
                            search={search}
                        />
                    </TabsContent>
                </TableCard>
            </Tabs>
        </div>
    );
}
