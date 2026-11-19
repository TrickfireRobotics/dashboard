"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { NotionIcon } from "@/components/icons/brand-icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { formatDate } from "@/lib/utils";

export type TaskSyncTeam = { id: number; name: string };
export type TaskSyncNotionDatabase = { id: string; title: string };

export type TaskSyncLink = {
    id: number;
    teamId: number;
    teamName: string;
    notionDatabaseId: string;
    notionDatabaseName: string | null;
    githubOwner: string;
    githubRepo: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    createdAt: string;
};

type TaskSyncTask = {
    id: number;
    notionTaskKey: string;
    githubIssueNumber: number;
    lastSyncedAt: string;
};

const formSchema = z.object({
    notionDatabaseId: z.string().min(1, "Choose a database"),
    teamId: z.string().min(1, "Choose a team"),
    githubOwner: z.string().trim().min(1, "Required"),
    githubRepo: z.string().trim().min(1, "Required"),
});
type FormValues = z.infer<typeof formSchema>;

function AddLinkDialog({
    teams,
    notionDatabases,
}: {
    teams: TaskSyncTeam[];
    notionDatabases: TaskSyncNotionDatabase[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const disabled = teams.length === 0 || notionDatabases.length === 0;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { notionDatabaseId: "", teamId: "", githubOwner: "", githubRepo: "" },
    });

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/task-sync/links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Failed to create link");
            toast.success(
                data?.summary
                    ? `Linked and synced: ${data.summary.created} issue(s) created`
                    : "Link created"
            );
            setOpen(false);
            form.reset();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) form.reset();
            }}
        >
            <DialogTrigger render={<Button disabled={disabled} />}>
                <Plus className="size-4" />
                Add link
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Link a Notion database to a repo</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="notionDatabaseId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notion database</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Choose a task database" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {notionDatabases.map((d) => (
                                                <SelectItem key={d.id} value={d.id}>
                                                    {d.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="teamId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Team</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Choose a subteam" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {teams.map((t) => (
                                                <SelectItem key={t.id} value={String(t.id)}>
                                                    {t.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="githubOwner"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>GitHub owner/org</FormLabel>
                                        <FormControl>
                                            <Input placeholder="TrickFireRobotics" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="githubRepo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Repository</FormLabel>
                                        <FormControl>
                                            <Input placeholder="arm" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Linking..." : "Create link"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function LinkRow({ link }: { link: TaskSyncLink }) {
    const router = useRouter();
    const [syncing, setSyncing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [tasks, setTasks] = useState<TaskSyncTask[] | null>(null);
    const [tasksLoading, setTasksLoading] = useState(false);

    async function loadTasks() {
        setTasksLoading(true);
        try {
            const res = await fetch(`/api/task-sync/links/${link.id}/tasks`, { cache: "no-store" });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Failed to load tasks");
            setTasks(data?.tasks ?? []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load tasks");
        } finally {
            setTasksLoading(false);
        }
    }

    async function sync() {
        setSyncing(true);
        try {
            const res = await fetch(`/api/task-sync/links/${link.id}/sync`, { method: "POST" });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Sync failed");
            const s = data.summary as {
                created: number;
                updatedFromNotion: number;
                updatedFromGithub: number;
                closed: number;
                errors: string[];
            };
            if (s.errors.length > 0) {
                toast.error(`Synced with an error: ${s.errors[0]}`);
            } else {
                toast.success(
                    `Synced: ${s.created} created, ${s.updatedFromNotion + s.updatedFromGithub} updated, ${s.closed} closed`
                );
            }
            router.refresh();
            if (expanded) loadTasks();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Sync failed");
        } finally {
            setSyncing(false);
        }
    }

    async function remove() {
        if (!confirm(`Remove the link for ${link.teamName}? Already-synced issues stay on GitHub.`))
            return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/task-sync/links/${link.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to remove link");
            }
            toast.success("Link removed");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <Collapsible
            open={expanded}
            onOpenChange={(next) => {
                setExpanded(next);
                if (next && tasks === null) loadTasks();
            }}
            className="border-border rounded-lg border"
        >
            <div className="flex flex-wrap items-center gap-3 p-4">
                <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" />}>
                    <ChevronDown
                        className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                </CollapsibleTrigger>

                <div className="min-w-0 flex-1">
                    <p className="font-medium">{link.teamName}</p>
                    <p className="text-muted-foreground text-xs">
                        {link.notionDatabaseName ?? link.notionDatabaseId} {"→"}{" "}
                        <a
                            href={`https://github.com/${link.githubOwner}/${link.githubRepo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                        >
                            {link.githubOwner}/{link.githubRepo}
                        </a>
                    </p>
                    {link.lastSyncError ? (
                        <p className="text-destructive mt-1 text-xs">{link.lastSyncError}</p>
                    ) : (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {link.lastSyncedAt
                                ? `Last synced ${formatDate(new Date(link.lastSyncedAt))}`
                                : "Never synced"}
                        </p>
                    )}
                </div>

                <Button size="sm" variant="outline" disabled={syncing} onClick={sync}>
                    <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync now"}
                </Button>
                <Button size="sm" variant="destructive" disabled={deleting} onClick={remove}>
                    <Trash2 className="size-4" />
                </Button>
            </div>

            <CollapsibleContent className="border-border border-t p-4">
                {tasksLoading ? (
                    <p className="text-muted-foreground text-sm">Loading tasks...</p>
                ) : !tasks || tasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No tasks synced yet.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Issue</TableHead>
                                <TableHead className="hidden md:table-cell">Last synced</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.notionTaskKey}</TableCell>
                                    <TableCell>
                                        <a
                                            href={`https://github.com/${link.githubOwner}/${link.githubRepo}/issues/${t.githubIssueNumber}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline"
                                        >
                                            #{t.githubIssueNumber}
                                        </a>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                        {formatDate(new Date(t.lastSyncedAt))}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

export function TaskSyncManager({
    teams,
    notionDatabases,
    links,
}: {
    teams: TaskSyncTeam[];
    notionDatabases: TaskSyncNotionDatabase[];
    links: TaskSyncLink[];
}) {
    const linkedTeamIds = new Set(links.map((l) => l.teamId));
    const availableTeams = teams.filter((t) => !linkedTeamIds.has(t.id));

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <AddLinkDialog teams={availableTeams} notionDatabases={notionDatabases} />
            </div>

            {links.length === 0 ? (
                <EmptyState
                    icon={NotionIcon}
                    title="No links yet"
                    description="Add a link to start mirroring a subteam's Notion tasks to GitHub issues."
                />
            ) : (
                <div className="space-y-3">
                    {links.map((link) => (
                        <LinkRow key={link.id} link={link} />
                    ))}
                </div>
            )}
        </div>
    );
}
