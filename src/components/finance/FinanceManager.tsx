"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDate, formatPriceCents } from "@/lib/utils";

type OrderPricing = {
    taxPercent: number;
    shippingPercent: number;
};

type StfBucket = {
    id: number;
    name: string;
    startingBalanceCents: number;
    remainingBalanceCents: number;
    approvedSpendCents: number;
    isActive: boolean;
};

type Quarter = {
    id: number;
    name: string;
    isActive: boolean;
    archivedAt: Date | null;
};

type GiftLogEntry = {
    id: number;
    timestamp: Date;
    changeType: string;
    previousValueCents: number;
    newValueCents: number;
    note: string | null;
};

export type FinanceData = {
    giftBalanceCents: number;
    stfBuckets: StfBucket[];
    quarters: Quarter[];
    giftLog: GiftLogEntry[];
    orderPricing: OrderPricing;
};

export function FinanceManager({ initial }: { initial: FinanceData }) {
    const router = useRouter();
    const [data, setData] = useState(initial);
    const [busy, setBusy] = useState<string | null>(null);
    const [newBucketName, setNewBucketName] = useState("");
    const [newBucketBalance, setNewBucketBalance] = useState("");
    const [giftValue, setGiftValue] = useState("");
    const [giftNote, setGiftNote] = useState("");
    const [newQuarterName, setNewQuarterName] = useState("");
    const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
    const [resetConfirmName, setResetConfirmName] = useState("");
    const [nextQuarterName, setNextQuarterName] = useState("");
    const [taxPercent, setTaxPercent] = useState(String(initial.orderPricing.taxPercent));
    const [shippingPercent, setShippingPercent] = useState(
        String(initial.orderPricing.shippingPercent)
    );

    const activeQuarter = data.quarters.find((q) => q.isActive);

    async function refresh() {
        const res = await fetch("/api/admin/finance");
        if (res.ok) {
            const next = await res.json();
            setData(next);
            setTaxPercent(String(next.orderPricing.taxPercent));
            setShippingPercent(String(next.orderPricing.shippingPercent));
            router.refresh();
        }
    }

    async function createQuarter() {
        if (!newQuarterName.trim()) return;
        setBusy("quarter");
        try {
            const res = await fetch("/api/admin/finance/buckets", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quarterName: newQuarterName.trim() }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Failed to create school year");
            }
            toast.success("School year created");
            setNewQuarterName("");
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function addBucket() {
        if (!newBucketName.trim() || !newBucketBalance) return;
        setBusy("bucket");
        try {
            const res = await fetch("/api/admin/finance/buckets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newBucketName.trim(),
                    startingBalance: Number(newBucketBalance),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Failed to add bucket");
            }
            toast.success("Bucket added");
            setNewBucketName("");
            setNewBucketBalance("");
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function updateBucket(
        id: number,
        patch: { name?: string; startingBalance?: number; isActive?: boolean }
    ) {
        setBusy(`bucket-${id}`);
        try {
            const res = await fetch(`/api/admin/finance/buckets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Update failed");
            }
            toast.success("Bucket updated");
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function adjustGift() {
        if (!giftValue) return;
        setBusy("gift");
        try {
            const res = await fetch("/api/admin/finance/gift", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    newValue: Number(giftValue),
                    note: giftNote || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Adjustment failed");
            }
            toast.success("Gift fund updated");
            setGiftValue("");
            setGiftNote("");
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function saveOrderPricing() {
        const tax = Number(taxPercent);
        const shipping = Number(shippingPercent);
        if (Number.isNaN(tax) || tax < 0 || Number.isNaN(shipping) || shipping < 0) {
            toast.error("Tax and shipping must be zero or positive");
            return;
        }

        setBusy("pricing");
        try {
            const res = await fetch("/api/admin/finance/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taxPercent: tax, shippingPercent: shipping }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Failed to update order pricing");
            }
            toast.success("Order pricing updated");
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function resetQuarter() {
        if (!activeQuarter) return;
        setBusy("reset");
        try {
            const res = await fetch("/api/admin/finance/quarter-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quarterName: resetConfirmName.trim(),
                    newQuarterName: nextQuarterName.trim(),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Reset failed");
            }
            toast.success("School year reset complete");
            setResetStep(0);
            setResetConfirmName("");
            setNextQuarterName("");
            await refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-10">
            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">STF school year</h2>
                    <p className="text-muted-foreground text-sm">
                        Active school year: {activeQuarter?.name ?? "None"}
                    </p>
                </div>
                {!activeQuarter ? (
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="new-quarter">School year</Label>
                            <Input
                                id="new-quarter"
                                placeholder="2025-2026"
                                value={newQuarterName}
                                onChange={(e) => setNewQuarterName(e.target.value)}
                            />
                        </div>
                        <Button onClick={createQuarter} disabled={busy === "quarter"}>
                            Create school year
                        </Button>
                    </div>
                ) : (
                    <Button variant="destructive" onClick={() => setResetStep(1)}>
                        Reset school year
                    </Button>
                )}
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold">STF buckets</h2>
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Starting</TableHead>
                                <TableHead className="text-right">Spent</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.stfBuckets.map((b) => (
                                <TableRow key={b.id}>
                                    <TableCell>{b.name}</TableCell>
                                    <TableCell className="text-right">
                                        {formatPriceCents(b.startingBalanceCents)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatPriceCents(b.approvedSpendCents)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatPriceCents(b.remainingBalanceCents)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={busy === `bucket-${b.id}`}
                                            onClick={() => {
                                                const name = prompt("Bucket name", b.name);
                                                if (!name) return;
                                                const balance = prompt(
                                                    "Starting balance (USD)",
                                                    String(b.startingBalanceCents / 100)
                                                );
                                                if (balance == null) return;
                                                updateBucket(b.id, {
                                                    name,
                                                    startingBalance: Number(balance),
                                                });
                                            }}
                                        >
                                            Edit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {activeQuarter ? (
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="bucket-name">New bucket</Label>
                            <Input
                                id="bucket-name"
                                placeholder="Mechanical"
                                value={newBucketName}
                                onChange={(e) => setNewBucketName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="bucket-balance">Starting balance (USD)</Label>
                            <Input
                                id="bucket-balance"
                                type="number"
                                min={0}
                                step="0.01"
                                value={newBucketBalance}
                                onChange={(e) => setNewBucketBalance(e.target.value)}
                            />
                        </div>
                        <Button onClick={addBucket} disabled={busy === "bucket"}>
                            Add bucket
                        </Button>
                    </div>
                ) : null}
            </section>

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Order pricing</h2>
                    <p className="text-muted-foreground text-sm">
                        Tax and shipping percentages applied to order totals for balance checks and
                        spend tracking.
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="tax-percent">Tax (%)</Label>
                        <Input
                            id="tax-percent"
                            type="number"
                            min={0}
                            step="0.01"
                            value={taxPercent}
                            onChange={(e) => setTaxPercent(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="shipping-percent">Shipping (%)</Label>
                        <Input
                            id="shipping-percent"
                            type="number"
                            min={0}
                            step="0.01"
                            value={shippingPercent}
                            onChange={(e) => setShippingPercent(e.target.value)}
                        />
                    </div>
                    <Button onClick={saveOrderPricing} disabled={busy === "pricing"}>
                        Save pricing
                    </Button>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Gift fund</h2>
                <p className="text-foreground text-2xl font-semibold">
                    {formatPriceCents(data.giftBalanceCents)}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="gift-value">Set value (USD)</Label>
                        <Input
                            id="gift-value"
                            type="number"
                            min={0}
                            step="0.01"
                            value={giftValue}
                            onChange={(e) => setGiftValue(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="gift-note">Note (optional)</Label>
                        <Input
                            id="gift-note"
                            placeholder="New Gift deposit"
                            value={giftNote}
                            onChange={(e) => setGiftNote(e.target.value)}
                        />
                    </div>
                    <Button onClick={adjustGift} disabled={busy === "gift"}>
                        Update gift fund
                    </Button>
                </div>
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Previous</TableHead>
                                <TableHead className="text-right">New</TableHead>
                                <TableHead>Note</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.giftLog.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell>{formatDate(entry.timestamp)}</TableCell>
                                    <TableCell>{entry.changeType}</TableCell>
                                    <TableCell className="text-right">
                                        {formatPriceCents(entry.previousValueCents)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatPriceCents(entry.newValueCents)}
                                    </TableCell>
                                    <TableCell>{entry.note ?? "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>

            <Dialog open={resetStep > 0} onOpenChange={(open) => !open && setResetStep(0)}>
                <DialogContent>
                    {resetStep === 1 ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Reset school year?</DialogTitle>
                                <DialogDescription>
                                    This will archive all STF buckets for{" "}
                                    <strong>{activeQuarter?.name}</strong> and clear them for the
                                    new school year. Gift fund orders and value are not affected.
                                    This cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setResetStep(0)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={() => setResetStep(2)}>
                                    Continue
                                </Button>
                            </div>
                        </>
                    ) : resetStep === 2 ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Confirm reset</DialogTitle>
                                <DialogDescription>
                                    Type <strong>{activeQuarter?.name}</strong> to confirm, then
                                    enter the name for the incoming school year.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="confirm-quarter">Current school year</Label>
                                    <Input
                                        id="confirm-quarter"
                                        value={resetConfirmName}
                                        onChange={(e) => setResetConfirmName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="next-quarter">New school year</Label>
                                    <Input
                                        id="next-quarter"
                                        placeholder="2026-2027"
                                        value={nextQuarterName}
                                        onChange={(e) => setNextQuarterName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setResetStep(1)}>
                                    Back
                                </Button>
                                <Button
                                    variant="destructive"
                                    disabled={
                                        busy === "reset" ||
                                        resetConfirmName !== activeQuarter?.name ||
                                        !nextQuarterName.trim()
                                    }
                                    onClick={resetQuarter}
                                >
                                    Confirm reset
                                </Button>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
