"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
    username: z
        .string()
        .min(3, "Username is too short")
        .max(16, "Username is too long")
        .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscore only"),
    requestNote: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function WhitelistRequestForm() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { username: "", requestNote: "" },
    });

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/minecraft/whitelist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: values.username,
                    requestNote: values.requestNote || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to submit request");
            }
            toast.success("Whitelist request submitted");
            form.reset();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Minecraft username</FormLabel>
                            <FormControl>
                                <Input placeholder="Notch" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="requestNote"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Note (optional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    rows={2}
                                    placeholder="Anything the admins should know."
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Request whitelist"}
                </Button>
            </form>
        </Form>
    );
}
