"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

const nameSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
});

const emailSchema = z.object({
    newEmail: z.string().trim().email("Enter a valid email address").max(200),
});

type NameValues = z.infer<typeof nameSchema>;
type EmailValues = z.infer<typeof emailSchema>;

export function SettingsForm({
    name,
    email,
    onCooldown,
    cooldownUntil,
}: {
    name: string;
    email: string;
    onCooldown: boolean;
    cooldownUntil: string | null;
}) {
    const router = useRouter();
    const [nameSubmitting, setNameSubmitting] = useState(false);
    const [emailSubmitting, setEmailSubmitting] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [pendingName, setPendingName] = useState<string | null>(null);

    const nameForm = useForm<NameValues>({
        resolver: zodResolver(nameSchema),
        defaultValues: { name },
    });

    const emailForm = useForm<EmailValues>({
        resolver: zodResolver(emailSchema),
        defaultValues: { newEmail: "" },
    });

    function onNameSubmit(values: NameValues) {
        if (values.name === name) {
            toast.info("No change to save.");
            return;
        }
        setPendingName(values.name);
    }

    async function confirmNameChange() {
        if (!pendingName) return;
        setNameSubmitting(true);
        try {
            const res = await fetch("/api/user/name", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: pendingName }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error ?? "Failed to update name");
            }
            toast.success("Name updated.");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setNameSubmitting(false);
            setPendingName(null);
        }
    }

    async function onEmailSubmit(values: EmailValues) {
        if (values.newEmail === email) {
            toast.info("That's already your email.");
            return;
        }
        setEmailSubmitting(true);
        const { error } = await authClient.changeEmail({
            newEmail: values.newEmail,
            callbackURL: "/settings",
        });
        setEmailSubmitting(false);
        if (error) {
            toast.error(error.message ?? "Failed to request email change");
            return;
        }
        setEmailSent(true);
        emailForm.reset();
    }

    return (
        <div className="max-w-lg space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Display name</CardTitle>
                    {onCooldown && cooldownUntil && (
                        <CardDescription>
                            You can change your name again on {cooldownUntil}.
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    <Form {...nameForm}>
                        <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="space-y-4">
                            <FormField
                                control={nameForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} disabled={onCooldown} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={nameSubmitting || onCooldown}>
                                {nameSubmitting ? "Saving…" : "Save name"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <AlertDialog
                open={pendingName != null}
                onOpenChange={(open) => !open && setPendingName(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change display name?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your name will be changed to &ldquo;{pendingName}&rdquo;. You won&apos;t
                            be able to change it again for 7 days.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmNameChange} disabled={nameSubmitting}>
                            {nameSubmitting ? "Saving…" : "Change name"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader>
                    <CardTitle>Email address</CardTitle>
                    <CardDescription>Current: {email}</CardDescription>
                </CardHeader>
                <CardContent>
                    {emailSent ? (
                        <p className="text-muted-foreground text-sm">
                            A confirmation link has been sent to your new address. Click it to
                            complete the change.
                        </p>
                    ) : (
                        <Form {...emailForm}>
                            <form
                                onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                                className="space-y-4"
                            >
                                <FormField
                                    control={emailForm.control}
                                    name="newEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>New email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    placeholder="new@example.com"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={emailSubmitting}>
                                    {emailSubmitting ? "Sending…" : "Send confirmation"}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
