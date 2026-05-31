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

const schema = z.object({
    deviceName: z.string().trim().min(1, "Device name is required").max(100),
    machineKey: z.string().trim().max(200).optional(),
    requestNote: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

export function JoinRequestForm() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { deviceName: "", machineKey: "", requestNote: "" },
    });

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/headscale/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Submission failed");
            }
            toast.success("Join request submitted!");
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
                    name="deviceName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Device name</FormLabel>
                            <FormControl>
                                <Input placeholder="my-laptop" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="machineKey"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Machine key (optional)</FormLabel>
                            <FormControl>
                                <Input placeholder="mkey:..." {...field} />
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
                                    placeholder="What do you need network access for?"
                                    className="resize-none"
                                    rows={3}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting…" : "Request access"}
                </Button>
            </form>
        </Form>
    );
}
