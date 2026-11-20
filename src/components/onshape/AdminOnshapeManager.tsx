"use client";

import { Boxes, Users } from "lucide-react";
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
import type {
    OnshapeCompany,
    OnshapeMember,
    OnshapeTeam,
    OnshapeTeamMember,
} from "@/lib/integrations/onshape";
import { usePoll } from "@/lib/use-poll";
import { formatDate } from "@/lib/utils";

type MemberRole = "member" | "admin" | "light" | "guest";

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
    { value: "member", label: "Member" },
    { value: "admin", label: "Admin" },
    { value: "light", label: "Light user" },
    { value: "guest", label: "Guest" },
];

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

function roleTone(role: MemberRole): "default" | "elevated" | "muted" {
    if (role === "admin") return "elevated";
    if (role === "guest" || role === "light") return "muted";
    return "default";
}

/** Admins first (alphabetically), then everyone else - one table, two groups. */
function sortMembers(members: OnshapeMember[]): OnshapeMember[] {
    return [...members].sort((a, b) => {
        if (a.admin !== b.admin) return a.admin ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

function PeopleTab({ onCounts }: { onCounts: (counts: { members: number }) => void }) {
    const [members, setMembers] = useState<OnshapeMember[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<MemberRole>("member");
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
            onCounts({ members: data?.members?.length ?? 0 });
        } catch {
            setError("Failed to load members");
        } finally {
            setLoading(false);
        }
    }, [onCounts]);

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
                body: JSON.stringify({ email: email.trim(), ...roleToFlags(role) }),
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

    async function changeRole(member: OnshapeMember, next: MemberRole) {
        if (!member.userId || !member.email) {
            toast.error("Cannot resolve this member's id or email");
            return;
        }
        setBusy(member.userId);
        try {
            const res = await fetch(`/api/admin/onshape/members/${member.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: member.email, ...roleToFlags(next) }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to update role");
            }
            toast.success(`${member.name} is now ${next}`);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update role");
        } finally {
            setBusy(null);
        }
    }

    return (
        <>
            <AddPersonBar hint="Onshape emails the invitation. The access level can be changed at any time from the list below.">
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
                    <Label htmlFor="onshape-role">Access level</Label>
                    <Select
                        items={ROLE_OPTIONS}
                        value={role}
                        onValueChange={(v) => setRole(v as MemberRole)}
                    >
                        <SelectTrigger id="onshape-role" className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={addMember} disabled={adding}>
                    {adding ? "Inviting…" : "Invite"}
                </Button>
            </AddPersonBar>

            <LoadState
                loading={loading}
                error={error}
                empty={(members?.length ?? 0) === 0}
                emptyLabel="No company members found."
            >
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Access level</TableHead>
                                <TableHead className="hidden md:table-cell">Added</TableHead>
                                <TableHead className="hidden md:table-cell">Last login</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortMembers(members ?? []).map((m, i) => (
                                <TableRow key={m.userId ?? `${m.name}-${i}`}>
                                    <TableCell className="font-medium">
                                        {m.name}
                                        {m.email ? (
                                            <p className="text-muted-foreground text-xs font-normal">
                                                {m.email}
                                            </p>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        <LevelSelect
                                            value={roleOf(m)}
                                            options={ROLE_OPTIONS}
                                            disabled={!m.userId || !m.email || busy === m.userId}
                                            tone={roleTone(roleOf(m))}
                                            onChange={(next) => changeRole(m, next)}
                                        />
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
                                        <RemoveButton
                                            disabled={!m.userId || busy === m.userId}
                                            onClick={() => removeMember(m)}
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
                onCounts({ teams: data?.teams?.length ?? 0 });
            })
            .catch(() => setError("Failed to load teams"))
            .finally(() => setLoading(false));
    }, [onCounts]);

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

    const groups: TeamGroup[] = (teams ?? []).map((t) => ({
        key: t.id,
        name: t.name,
        description: t.description,
    }));

    return (
        <TeamsBrowser
            groups={groups}
            loading={loading}
            error={error}
            selectedKey={selected?.id ?? null}
            onSelect={(group) => {
                const team = teams?.find((t) => t.id === group.key);
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
                                {(teamMembers ?? []).map((m, i) => (
                                    <li
                                        key={m.userId ?? `${m.name}-${i}`}
                                        className="flex items-center justify-between gap-3 py-2"
                                    >
                                        <span className="truncate font-medium">{m.name}</span>
                                        <Badge variant={m.admin ? "default" : "secondary"}>
                                            {m.admin ? "Team admin" : "Member"}
                                        </Badge>
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

export function AdminOnshapeManager({ company }: { company: OnshapeCompany | null }) {
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
                icon={Boxes}
                title={company?.name ?? "Onshape company"}
                subtitle={
                    company ? (
                        <>
                            Company ID <span className="font-mono">{company.id}</span>
                            {company.admin ? " · API key has admin access" : ""}
                        </>
                    ) : undefined
                }
                stats={[
                    { label: "Members", value: String(counts.members ?? "-") },
                    { label: "Teams", value: String(counts.teams ?? "-") },
                ]}
                note="Global permissions, Enterprise project roles, and per-team admin status aren't exposed by Onshape's API - manage those in the Onshape admin console."
            />

            <SubTabs
                value={tab}
                onValueChange={setTab}
                tabs={[
                    { value: "people", label: "People", icon: Users },
                    { value: "teams", label: "Teams", icon: Boxes },
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
