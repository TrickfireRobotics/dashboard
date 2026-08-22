"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname } from "next/navigation";
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
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { feedbackCategories, feedbackInputSchema } from "@/lib/validation";
import { FEEDBACK_CATEGORY_META } from "./FeedbackCategoryBadge";

type FormValues = z.infer<typeof feedbackInputSchema>;

export function FeedbackForm({ onSubmitted }: { onSubmitted: () => void }) {
    const pathname = usePathname();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(feedbackInputSchema),
        defaultValues: { category: "idea", message: "" },
    });

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, page: pathname }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Submission failed");
            }
            toast.success("Thanks for the feedback!");
            form.reset({ category: "idea", message: "" });
            onSubmitted();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col gap-4">
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Tabs
                                value={field.value}
                                onValueChange={(value) => field.onChange(value)}
                                orientation="vertical"
                            >
                                <TabsList className="bg-muted/50 border-border/60 dark:bg-muted/20 h-auto w-full flex-col items-stretch gap-1 rounded-xl border p-1.5">
                                    <TabsIndicator className="bg-primary shadow-primary/25 rounded-lg shadow-md" />
                                    {feedbackCategories.map((category) => {
                                        const { label, icon: Icon } =
                                            FEEDBACK_CATEGORY_META[category];
                                        return (
                                            <TabsTrigger
                                                key={category}
                                                value={category}
                                                className="data-active:text-primary-foreground dark:data-active:text-primary-foreground rounded-lg px-3 py-2 data-active:bg-transparent dark:data-active:bg-transparent"
                                            >
                                                <Icon className="size-4" />
                                                {label}
                                            </TabsTrigger>
                                        );
                                    })}
                                </TabsList>
                            </Tabs>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem className="flex flex-1 flex-col">
                            <FormLabel>What&apos;s on your mind?</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Tell us what's broken, missing, or could be better…"
                                    className="flex-1 resize-none"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Sending…" : "Send feedback"}
                </Button>
            </form>
        </Form>
    );
}
