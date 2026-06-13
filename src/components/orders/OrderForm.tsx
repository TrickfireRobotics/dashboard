"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { formatPriceCents } from "@/lib/utils";

type StfBucketBalance = {
    id: number;
    name: string;
    remainingBalanceCents: number;
};

type Balances = {
    giftBalanceCents: number;
    stfBuckets: StfBucketBalance[];
};

const formSchema = z
    .object({
        fundType: z.enum(["STF", "Gift"], { message: "Select a fund type" }),
        stfBucketId: z.string().optional(),
        vendor: z.string().min(1, "Vendor is required").max(200),
        link: z.string().url("Enter a valid URL").max(500),
        itemName: z.string().min(1, "Item name is required").max(200),
        partNumber: z.string().max(100).optional(),
        quantity: z
            .string()
            .min(1, "Required")
            .regex(/^\d+$/, "Whole number")
            .refine((v) => Number(v) >= 1 && Number(v) <= 9999, "Between 1 and 9999"),
        unitCost: z
            .string()
            .min(1, "Unit cost is required")
            .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Enter a valid amount"),
        notes: z.string().max(2000).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.fundType === "STF") {
            if (!data.stfBucketId) {
                ctx.addIssue({
                    code: "custom",
                    message: "Select an STF bucket",
                    path: ["stfBucketId"],
                });
            }
            if (!data.partNumber?.trim()) {
                ctx.addIssue({
                    code: "custom",
                    message: "Part number is required for STF orders",
                    path: ["partNumber"],
                });
            }
        }
        if (data.fundType === "Gift" && !data.notes?.trim()) {
            ctx.addIssue({
                code: "custom",
                message: "Notes are required for Gift orders",
                path: ["notes"],
            });
        }
    });

type FormValues = z.infer<typeof formSchema>;

export function OrderForm() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [balances, setBalances] = useState<Balances | null>(null);
    const [loadingBalances, setLoadingBalances] = useState(true);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fundType: undefined,
            stfBucketId: "",
            vendor: "",
            link: "",
            itemName: "",
            partNumber: "",
            quantity: "1",
            unitCost: "",
            notes: "",
        },
    });

    const fundType = form.watch("fundType");
    const stfBucketId = form.watch("stfBucketId");
    const quantity = form.watch("quantity");
    const unitCost = form.watch("unitCost");

    useEffect(() => {
        fetch("/api/orders/balances")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: Balances | null) => setBalances(data))
            .finally(() => setLoadingBalances(false));
    }, []);

    const totalCostCents = useMemo(() => {
        const qty = Number(quantity);
        const cost = Number(unitCost);
        if (!Number.isFinite(qty) || !Number.isFinite(cost) || qty < 1 || cost <= 0) return null;
        return Math.round(qty * cost * 100);
    }, [quantity, unitCost]);

    const balanceError = useMemo(() => {
        if (!fundType || totalCostCents == null || !balances) return null;

        if (fundType === "Gift") {
            if (totalCostCents > balances.giftBalanceCents) {
                return `This order exceeds the remaining balance in Gift Fund. Available: ${formatPriceCents(balances.giftBalanceCents)}, Order total: ${formatPriceCents(totalCostCents)}.`;
            }
            return null;
        }

        const bucket = balances.stfBuckets.find((b) => String(b.id) === stfBucketId);
        if (!bucket) return null;
        if (totalCostCents > bucket.remainingBalanceCents) {
            return `This order exceeds the remaining balance in ${bucket.name}. Available: ${formatPriceCents(bucket.remainingBalanceCents)}, Order total: ${formatPriceCents(totalCostCents)}.`;
        }
        return null;
    }, [balances, fundType, stfBucketId, totalCostCents]);

    const canSubmit =
        !!fundType &&
        !balanceError &&
        !submitting &&
        !loadingBalances &&
        balances !== null &&
        (fundType !== "STF" || balances.stfBuckets.length > 0);

    async function onSubmit(values: FormValues) {
        if (balanceError) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fundType: values.fundType,
                    stfBucketId: values.fundType === "STF" ? Number(values.stfBucketId) : undefined,
                    vendor: values.vendor,
                    link: values.link,
                    itemName: values.itemName,
                    partNumber: values.partNumber || undefined,
                    quantity: Number(values.quantity),
                    unitCost: Number(values.unitCost),
                    notes: values.notes || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to submit order");
            }
            toast.success("Order submitted for review");
            router.push("/orders");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
            setSubmitting(false);
        }
    }

    const fundTypeItems = { STF: "STF", Gift: "Gift" };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="fundType"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fund type</FormLabel>
                            <Select
                                items={fundTypeItems}
                                value={field.value ?? ""}
                                onValueChange={(v) => {
                                    field.onChange(v);
                                    form.setValue("stfBucketId", "");
                                }}
                            >
                                <FormControl>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select fund type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="STF">STF</SelectItem>
                                    <SelectItem value="Gift">Gift</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {fundType === "Gift" && balances ? (
                    <div className="bg-muted/50 rounded-lg border px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Gift fund balance: </span>
                        <span className="text-foreground font-semibold">
                            {formatPriceCents(balances.giftBalanceCents)}
                        </span>
                    </div>
                ) : null}

                {fundType === "STF" ? (
                    <FormField
                        control={form.control}
                        name="stfBucketId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>STF bucket</FormLabel>
                                <Select
                                    items={Object.fromEntries(
                                        (balances?.stfBuckets ?? []).map((b) => [
                                            String(b.id),
                                            `${b.name} — ${formatPriceCents(b.remainingBalanceCents)} remaining`,
                                        ])
                                    )}
                                    value={field.value ?? ""}
                                    onValueChange={field.onChange}
                                >
                                    <FormControl>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select STF bucket" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {(balances?.stfBuckets ?? []).map((bucket) => {
                                            const disabled = bucket.remainingBalanceCents <= 0;
                                            return (
                                                <SelectItem
                                                    key={bucket.id}
                                                    value={String(bucket.id)}
                                                    disabled={disabled}
                                                >
                                                    {bucket.name} —{" "}
                                                    {formatPriceCents(bucket.remainingBalanceCents)}{" "}
                                                    remaining
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                {balances?.stfBuckets.length === 0 ? (
                                    <FormDescription>
                                        No STF buckets are configured. Contact an officer.
                                    </FormDescription>
                                ) : null}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : null}

                <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Vendor</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. McMaster-Carr" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="link"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Link</FormLabel>
                            <FormControl>
                                <Input type="url" placeholder="https://..." {...field} />
                            </FormControl>
                            <FormDescription>Direct link to the product page.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="itemName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Item name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. 1/4-20 hex bolt" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="partNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Part number{fundType === "Gift" ? " (optional)" : ""}
                                </FormLabel>
                                <FormControl>
                                    <Input placeholder="Optional for Gift" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                    <Input type="number" min={1} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cost (unit)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                />
                            </FormControl>
                            {totalCostCents != null ? (
                                <FormDescription>
                                    Total cost:{" "}
                                    <span className="text-foreground font-medium">
                                        {formatPriceCents(totalCostCents)}
                                    </span>
                                </FormDescription>
                            ) : null}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {balanceError ? (
                    <p className="text-destructive text-sm" role="alert">
                        {balanceError}
                    </p>
                ) : null}

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes{fundType === "STF" ? " (optional)" : ""}</FormLabel>
                            <FormControl>
                                <Textarea
                                    rows={4}
                                    placeholder={
                                        fundType === "Gift"
                                            ? "Explain what the item is for or where it will be used."
                                            : "Any extra details for reviewers."
                                    }
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-3">
                    <Button type="submit" disabled={!canSubmit}>
                        {submitting ? "Submitting..." : "Submit order"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push("/orders")}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </Form>
    );
}
