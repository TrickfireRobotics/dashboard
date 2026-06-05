"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import type { VaultEntryType } from "@/lib/db/schema";

export type VaultEntryRow = {
    id: number;
    name: string;
    type: VaultEntryType;
    description: string | null;
    username: string | null;
    createdAt: Date;
};

function makeSchema(isEdit: boolean) {
    return z
        .object({
            type: z.enum(["login", "api_key"]),
            name: z.string().trim().min(1, "Name is required").max(100),
            username: z.string().trim().max(200).optional(),
            // Optional when editing - leave blank to keep the existing secret.
            secret: z.string().max(5000).optional(),
            description: z.string().trim().max(1000).optional(),
        })
        .superRefine((v, ctx) => {
            if (v.type === "login" && !v.username?.trim()) {
                ctx.addIssue({
                    code: "custom",
                    path: ["username"],
                    message: "Username is required",
                });
            }
            if (!isEdit && !v.secret?.trim()) {
                ctx.addIssue({
                    code: "custom",
                    path: ["secret"],
                    message: "Secret is required",
                });
            }
        });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export function VaultEntryDialog({
    open,
    onOpenChange,
    entry,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry?: VaultEntryRow;
}) {
    const router = useRouter();
    const isEdit = entry !== undefined;
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(makeSchema(isEdit)),
        defaultValues: {
            type: "login",
            name: "",
            username: "",
            secret: "",
            description: "",
        },
    });

    // Reset the form whenever the dialog opens (with or without an entry).
    useEffect(() => {
        if (!open) return;
        form.reset({
            type: entry?.type ?? "login",
            name: entry?.name ?? "",
            username: entry?.username ?? "",
            secret: "",
            description: entry?.description ?? "",
        });
    }, [open, entry, form]);

    const type = form.watch("type");

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const url = isEdit ? `/api/admin/vault/${entry.id}` : "/api/admin/vault";
            const method = isEdit ? "PATCH" : "POST";

            const body: Record<string, unknown> = isEdit
                ? {
                      name: values.name,
                      description: values.description?.trim() || undefined,
                      ...(values.type === "login"
                          ? { username: values.username?.trim() }
                          : {}),
                      ...(values.secret?.trim() ? { secret: values.secret } : {}),
                  }
                : {
                      type: values.type,
                      name: values.name,
                      description: values.description?.trim() || undefined,
                      secret: values.secret,
                      ...(values.type === "login"
                          ? { username: values.username?.trim() }
                          : {}),
                  };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to save entry");
            }
            toast.success(isEdit ? "Entry updated" : "Entry created");
            onOpenChange(false);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit entry" : "New vault entry"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update this entry. Leave the secret blank to keep the current value."
                            : "Choose what kind of credential to store."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Entry type</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        disabled={isEdit}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="login">
                                                Login &amp; password
                                            </SelectItem>
                                            <SelectItem value="api_key">API key</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {isEdit ? (
                                        <FormDescription>
                                            Type can&apos;t be changed after creation.
                                        </FormDescription>
                                    ) : null}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Resend (email)" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {type === "login" ? (
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="login@example.com"
                                                autoComplete="off"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}

                        <FormField
                            control={form.control}
                            name="secret"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {type === "login" ? "Password" : "API key"}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder={
                                                isEdit ? "Leave blank to keep current" : ""
                                            }
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {type === "api_key" ? (
                            <p className="text-muted-foreground text-sm">
                                API keys are never shown in the dashboard. They&apos;re fetched
                                from an authenticated endpoint; grant per-person access from the
                                entry&apos;s &ldquo;Manage access&rdquo; action.
                            </p>
                        ) : null}

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            rows={2}
                                            placeholder="What this is for, scope, etc."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Saving..." : isEdit ? "Save changes" : "Create"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
