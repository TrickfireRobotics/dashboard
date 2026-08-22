"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type ControllerRenderProps, useFieldArray, useForm, useWatch } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/lib/db/schema";
import { computeOrderTotalCents, displayPercentToBps } from "@/lib/finance/order-pricing";
import { MAX_ORDER_BATCH_ITEMS } from "@/lib/validation";
import { cn, formatPriceCents } from "@/lib/utils";

import { PasteItemsPanel, type ParsedItem } from "./PasteItemsPanel";

type OrderPricing = { taxPercent: number; shippingPercent: number };

const itemSchema = z.object({
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
});

const formSchema = z.object({
    items: z.array(itemSchema).min(1).max(MAX_ORDER_BATCH_ITEMS),
});

type FormValues = z.infer<typeof formSchema>;
type ItemValues = z.infer<typeof itemSchema>;

const emptyItem: ItemValues = {
    vendor: "",
    link: "",
    itemName: "",
    partNumber: "",
    quantity: "1",
    unitCost: "",
    notes: "",
};

// Keeps an in-progress "new order" draft around in sessionStorage so closing
// the dialog (Escape, backdrop click, Cancel) without submitting doesn't
// lose what was typed. Only applies to new orders, never to edits.
const DRAFT_STORAGE_KEY = "trickfire-order-draft";

function loadDraftItems(): ItemValues[] | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ItemValues[];
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

function saveDraftItems(items: ItemValues[]) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(items));
    } catch {
        // storage unavailable or over quota; not worth surfacing to the user
    }
}

function clearDraftItems() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
}

function hasDraftContent(items: ItemValues[]): boolean {
    return items.some(
        (item) =>
            item?.vendor ||
            item?.link ||
            item?.itemName ||
            item?.partNumber ||
            item?.unitCost ||
            item?.notes
    );
}

// One shared track definition keeps the header labels aligned with every row.
// Every flexible track uses a 0 minimum so the row always fits the viewport
// instead of forcing a horizontal scrollbar; only the fixed tracks hold width.
// Qty and unit cost are fixed and generous on purpose — cramped number inputs
// are exactly where typos happen in a big batch.
const GRID_COLUMNS =
    "lg:grid-cols-[32px_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_90px_115px_minmax(0,1fr)_76px]";

export type OrderFormInitial = {
    id: number;
    status: OrderStatus;
    vendor: string;
    link: string;
    itemName: string;
    partNumber: string | null;
    quantity: number;
    unitCostCents: number;
    notes: string | null;
};

function toItemValues(order: OrderFormInitial): ItemValues {
    return {
        vendor: order.vendor,
        link: order.link,
        itemName: order.itemName,
        partNumber: order.partNumber ?? "",
        quantity: String(order.quantity),
        unitCost: (order.unitCostCents / 100).toFixed(2),
        notes: order.notes ?? "",
    };
}

// "https://www.mcmaster.com/91251A542/" -> "Mcmaster"
function vendorFromLink(link: string): string | null {
    try {
        const host = new URL(link).hostname.replace(/^www\./, "");
        const name = host.split(".")[0];
        if (!name || name.length < 2) return null;
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
        return null;
    }
}

// Only fills a vendor the user has not typed themselves.
function fillVendorFromLink(
    form: ReturnType<typeof useForm<FormValues>>,
    index: number,
    link: string
) {
    const guess = vendorFromLink(link);
    if (guess && !form.getValues(`items.${index}.vendor`)) {
        form.setValue(`items.${index}.vendor`, guess, { shouldValidate: true });
    }
}

export function OrderForm({
    initialOrder,
    initialItemCount = 1,
    onSuccess,
    onLayoutChange,
}: {
    initialOrder?: OrderFormInitial;
    initialItemCount?: number;
    onSuccess?: () => void;
    onLayoutChange?: (multiple: boolean) => void;
}) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [pricing, setPricing] = useState<OrderPricing | null>(null);

    const isEditing = initialOrder != null;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            items: isEditing
                ? [toItemValues(initialOrder)]
                : (loadDraftItems() ??
                  Array.from({ length: initialItemCount }, () => ({ ...emptyItem }))),
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const items = useWatch({ control: form.control, name: "items" });

    useEffect(() => {
        fetch("/api/orders/balances")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { orderPricing?: OrderPricing } | null) =>
                setPricing(data?.orderPricing ?? null)
            )
            .catch(() => setPricing(null));
    }, []);

    useEffect(() => {
        if (isEditing || !items) return;
        if (hasDraftContent(items)) {
            saveDraftItems(items);
        } else {
            clearDraftItems();
        }
    }, [isEditing, items]);

    const estimatedTotalCents = useMemo(() => {
        if (!pricing || !items) return null;
        const settings = {
            taxPercentBps: displayPercentToBps(pricing.taxPercent),
            shippingPercentBps: displayPercentToBps(pricing.shippingPercent),
        };
        let total = 0;
        for (const item of items) {
            const qty = Number(item?.quantity);
            const cost = Number(item?.unitCost);
            if (!Number.isFinite(qty) || !Number.isFinite(cost) || qty < 1 || cost <= 0) continue;
            total += computeOrderTotalCents(qty, Math.round(cost * 100), settings);
        }
        return total > 0 ? total : null;
    }, [items, pricing]);

    function addItems(parsed: ParsedItem[]) {
        const room = MAX_ORDER_BATCH_ITEMS - fields.length;
        const accepted = parsed.slice(0, Math.max(0, room));
        if (accepted.length === 0) {
            toast.error(`Limit is ${MAX_ORDER_BATCH_ITEMS} items per submission`);
            return;
        }
        append(accepted.map((item) => ({ ...emptyItem, ...item })));
        toast.success(`Added ${accepted.length} item${accepted.length === 1 ? "" : "s"}`);
        if (accepted.length < parsed.length) {
            toast.warning(`${parsed.length - accepted.length} skipped — batch limit reached`);
        }
    }

    function duplicateItem(index: number) {
        if (fields.length >= MAX_ORDER_BATCH_ITEMS) {
            toast.error(`Limit is ${MAX_ORDER_BATCH_ITEMS} items per submission`);
            return;
        }
        append({ ...form.getValues(`items.${index}`) });
    }

    async function submitItems(values: FormValues, mode: "close" | "next") {
        setSubmitting(true);
        try {
            const payloadItems = values.items.map((item) => ({
                vendor: item.vendor,
                link: item.link,
                itemName: item.itemName,
                partNumber: item.partNumber || undefined,
                quantity: Number(item.quantity),
                unitCost: Number(item.unitCost),
                notes: item.notes || undefined,
            }));

            const res = await fetch(isEditing ? `/api/orders/${initialOrder.id}` : "/api/orders", {
                method: isEditing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(isEditing ? payloadItems[0] : { items: payloadItems }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to submit order");
            }

            if (isEditing) {
                toast.success(
                    initialOrder.status === "denied"
                        ? "Order resubmitted for review"
                        : "Order updated"
                );
            } else {
                const count = payloadItems.length;
                toast.success(
                    count === 1
                        ? "Order submitted for review"
                        : `${count} orders submitted for review`
                );
                clearDraftItems();
            }

            if (mode === "next") {
                form.reset({ items: [{ ...emptyItem }] });
                router.refresh();
                setSubmitting(false);
                setTimeout(() => form.setFocus("items.0.itemName"), 0);
                return;
            }

            if (onSuccess) {
                onSuccess();
            } else {
                router.push("/orders");
            }
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
            setSubmitting(false);
        }
    }

    const multiple = fields.length > 1;

    useEffect(() => {
        onLayoutChange?.(multiple);
    }, [multiple, onLayoutChange]);

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit((values) => submitItems(values, "close"))}
                className={cn("space-y-5", multiple ? "w-full" : "max-w-2xl")}
            >
                {multiple ? (
                    <div className="border-border rounded-lg border">
                        {/* Column headers stand in for per-field labels, so they
                            only exist where the row layout is side by side. */}
                        <div
                            className={cn(
                                GRID_COLUMNS,
                                "bg-muted border-border text-muted-foreground sticky top-0 z-10 hidden items-center gap-3 rounded-t-lg border-b px-4 py-3 text-xs font-medium lg:grid"
                            )}
                        >
                            <span>#</span>
                            <span>Item name</span>
                            <span>Vendor</span>
                            <span>Link</span>
                            <span>Part number</span>
                            <span>Qty</span>
                            <span>Unit cost</span>
                            <span>Notes</span>
                            <span className="sr-only">Actions</span>
                        </div>
                        {fields.map((field, index) => (
                            <ItemRow
                                key={field.id}
                                form={form}
                                index={index}
                                onRemove={() => remove(index)}
                                onDuplicate={() => duplicateItem(index)}
                            />
                        ))}
                    </div>
                ) : (
                    fields.map((field, index) => (
                        <ItemFields key={field.id} form={form} index={index} />
                    ))
                )}

                {!isEditing ? (
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({ ...emptyItem })}
                            disabled={fields.length >= MAX_ORDER_BATCH_ITEMS}
                        >
                            <Plus className="size-4" />
                            Add another item
                        </Button>
                        <PasteItemsPanel onAdd={addItems} />
                        {multiple ? (
                            <span className="text-muted-foreground text-sm">
                                {fields.length} items
                                {estimatedTotalCents != null
                                    ? ` · est. ${formatPriceCents(estimatedTotalCents)}`
                                    : ""}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {!isEditing && estimatedTotalCents != null ? (
                    <p className="text-muted-foreground text-sm">
                        Estimated total (incl. tax &amp; shipping):{" "}
                        <span className="text-foreground font-medium">
                            {formatPriceCents(estimatedTotalCents)}
                        </span>
                        . An officer assigns each item to a fund when they review it, which sets the
                        final cost.
                    </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={submitting}>
                        {submitting
                            ? "Saving..."
                            : isEditing
                              ? initialOrder.status === "denied"
                                  ? "Resubmit for review"
                                  : "Save changes"
                              : multiple
                                ? `Submit ${fields.length} items`
                                : "Submit order"}
                    </Button>
                    {!isEditing ? (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={submitting}
                            onClick={form.handleSubmit((values) => submitItems(values, "next"))}
                        >
                            {submitting
                                ? "Saving..."
                                : multiple
                                  ? `Submit ${fields.length} & add next`
                                  : "Submit & add next"}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => (onSuccess ? onSuccess() : router.push("/orders"))}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </Form>
    );
}

function ItemFields({
    form,
    index,
}: {
    form: ReturnType<typeof useForm<FormValues>>;
    index: number;
}) {
    return (
        <div className="space-y-5">
            <FormField
                control={form.control}
                name={`items.${index}.vendor`}
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
                name={`items.${index}.link`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Link</FormLabel>
                        <FormControl>
                            <Input
                                type="url"
                                placeholder="https://..."
                                {...field}
                                onBlur={(e) => {
                                    field.onBlur();
                                    fillVendorFromLink(form, index, e.target.value);
                                }}
                            />
                        </FormControl>
                        <FormDescription>Direct link to the product page.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name={`items.${index}.itemName`}
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

            <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                    control={form.control}
                    name={`items.${index}.partNumber`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Part number (optional)</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. 91251A542" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
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

                <FormField
                    control={form.control}
                    name={`items.${index}.unitCost`}
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
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name={`items.${index}.notes`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                            <Textarea
                                rows={4}
                                placeholder="What is this for, or anything reviewers should know."
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

// Batch mode: one item per row, labelled once by the grid header above.
function ItemRow({
    form,
    index,
    onRemove,
    onDuplicate,
}: {
    form: ReturnType<typeof useForm<FormValues>>;
    index: number;
    onRemove: () => void;
    onDuplicate: () => void;
}) {
    function cell(
        name: "itemName" | "vendor" | "link" | "partNumber" | "quantity" | "unitCost" | "notes",
        label: string,
        input: (
            field: ControllerRenderProps<FormValues, `items.${number}.${typeof name}`>
        ) => ReactNode
    ) {
        return (
            <FormField
                control={form.control}
                name={`items.${index}.${name}` as const}
                render={({ field }) => (
                    <FormItem className="min-w-0 space-y-1">
                        {/* Visible while rows are stacked; the grid header
                            replaces it once the columns line up. */}
                        <FormLabel className="text-xs lg:sr-only">{label}</FormLabel>
                        <FormControl>{input(field)}</FormControl>
                        <FormMessage className="text-xs" />
                    </FormItem>
                )}
            />
        );
    }

    return (
        <div
            className={cn(
                GRID_COLUMNS,
                "border-border hover:bg-muted/30 grid grid-cols-1 items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0"
            )}
        >
            <span className="text-muted-foreground text-xs font-medium tabular-nums lg:pt-2">
                <span className="lg:hidden">Item {index + 1}</span>
                <span className="hidden lg:inline">{index + 1}</span>
            </span>

            {cell("itemName", "Item name", (field) => (
                <Input className="h-9" placeholder="1/4-20 hex bolt" {...field} />
            ))}

            {cell("vendor", "Vendor", (field) => (
                <Input className="h-9" placeholder="McMaster-Carr" {...field} />
            ))}

            {cell("link", "Link", (field) => (
                <Input
                    className="h-9"
                    type="url"
                    placeholder="https://..."
                    {...field}
                    onBlur={(e) => {
                        field.onBlur();
                        fillVendorFromLink(form, index, e.target.value);
                    }}
                />
            ))}

            {cell("partNumber", "Part number", (field) => (
                <Input className="h-9" placeholder="Optional" {...field} />
            ))}

            {cell("quantity", "Quantity", (field) => (
                <Input className="h-9" type="number" min={1} {...field} />
            ))}

            {cell("unitCost", "Unit cost", (field) => (
                <Input
                    className="h-9"
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                />
            ))}

            {cell("notes", "Notes", (field) => (
                <Input className="h-9" placeholder="Optional" {...field} />
            ))}

            <div className="flex gap-1 pt-0.5">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDuplicate}
                    aria-label={`Duplicate item ${index + 1}`}
                >
                    <Copy className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label={`Remove item ${index + 1}`}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
        </div>
    );
}
