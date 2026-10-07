"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTableCard, DataTableCardHeader } from "@/components/ui/data-table-card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import type {
    VendorChange,
    VendorDiff,
    VendorField,
    VendorImportInfo,
    VendorRecord,
} from "@/lib/vendors/import";

type Preview = {
    file: File;
    fileName: string;
    fileHash: string;
    baseImportId: number | null;
    totalCount: number;
    diff: VendorDiff;
};

type DiffTab = "added" | "removed" | "changed";

const PAGE_SIZE = 100;

const FIELD_LABELS: Record<VendorField, string> = {
    status: "Status",
    supplierId: "Supplier ID",
    category: "Category",
    group: "Group",
    uei: "UEI",
    email: "Email",
    contact: "Contact",
    remitAddress: "Remit-to",
    useFor: "Use for",
};

const FIELD_ORDER = Object.keys(FIELD_LABELS) as VendorField[];

export function VendorImportCard({ initialLatest }: { initialLatest: VendorImportInfo | null }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [latest, setLatest] = useState(initialLatest);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

    async function previewFile(file: File) {
        setBusy("preview");
        try {
            const form = new FormData();
            form.set("file", file);
            const res = await fetch("/api/admin/vendors/import/preview", {
                method: "POST",
                body: form,
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error ?? "Failed to read the file");
            setPreview({ file, ...json });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    async function applyPreview() {
        if (!preview) return;
        setBusy("apply");
        try {
            const form = new FormData();
            form.set("file", preview.file);
            form.set("fileHash", preview.fileHash);
            form.set(
                "baseImportId",
                preview.baseImportId == null ? "" : String(preview.baseImportId)
            );
            const res = await fetch("/api/admin/vendors/import", { method: "POST", body: form });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                if (res.status === 409) setPreview(null);
                throw new Error(json?.error ?? "Failed to update the vendor list");
            }
            setLatest(json.latest);
            setPreview(null);
            toast.success(
                `Vendor list updated: +${json.added} added, -${json.removed} removed, ~${json.changed} changed`
            );
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <DataTableCard>
            <DataTableCardHeader
                title="Approved vendors"
                description={
                    latest
                        ? `Last updated ${formatDate(new Date(latest.importedAt))}${latest.importedByName ? ` by ${latest.importedByName}` : ""} · ${latest.totalCount.toLocaleString()} vendors (${latest.approvedCount.toLocaleString()} approved)`
                        : "No vendor list loaded yet. Upload finance's supplier export to enable vendor search."
                }
                action={
                    <>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void previewFile(file);
                            }}
                        />
                        <Button
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => inputRef.current?.click()}
                        >
                            {busy === "preview" ? "Reading..." : "Upload export"}
                        </Button>
                    </>
                }
            />

            <Dialog
                open={preview !== null}
                onOpenChange={(open) => !open && busy !== "apply" && setPreview(null)}
            >
                <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
                    {preview ? (
                        <VendorDiffView
                            preview={preview}
                            busy={busy === "apply"}
                            onCancel={() => setPreview(null)}
                            onApply={applyPreview}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </DataTableCard>
    );
}

function VendorDiffView({
    preview,
    busy,
    onCancel,
    onApply,
}: {
    preview: Preview;
    busy: boolean;
    onCancel: () => void;
    onApply: () => void;
}) {
    const { diff } = preview;
    const total = diff.added.length + diff.removed.length + diff.changed.length;
    const [tab, setTab] = useState<DiffTab>(
        diff.added.length ? "added" : diff.removed.length ? "removed" : "changed"
    );
    const [filter, setFilter] = useState("");
    const [page, setPage] = useState(0);

    const needle = filter.trim().toLowerCase();
    const rows = useMemo(() => {
        const list: { supplierName: string }[] = diff[tab];
        return needle ? list.filter((r) => r.supplierName.toLowerCase().includes(needle)) : list;
    }, [diff, tab, needle]);
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <>
            <DialogHeader>
                <DialogTitle>Review vendor list changes</DialogTitle>
                <DialogDescription>
                    {preview.fileName} · {preview.totalCount.toLocaleString()} vendors. Nothing
                    changes until you apply.
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
                <span className="text-emerald-700 dark:text-emerald-400">
                    +{diff.added.length.toLocaleString()} added
                </span>
                <span className="text-destructive">
                    -{diff.removed.length.toLocaleString()} removed
                </span>
                <span className="text-amber-700 dark:text-amber-400">
                    ~{diff.changed.length.toLocaleString()} changed
                </span>
                <span className="text-muted-foreground">
                    {diff.unchangedCount.toLocaleString()} unchanged
                </span>
            </div>

            {total === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                    This file matches the current vendor list. There&apos;s nothing to apply.
                </p>
            ) : (
                <Tabs
                    value={tab}
                    onValueChange={(value) => {
                        setTab(value as DiffTab);
                        setPage(0);
                    }}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <TabsList>
                            <TabsTrigger value="added">Added ({diff.added.length})</TabsTrigger>
                            <TabsTrigger value="removed">
                                Removed ({diff.removed.length})
                            </TabsTrigger>
                            <TabsTrigger value="changed">
                                Changed ({diff.changed.length})
                            </TabsTrigger>
                        </TabsList>
                        <Input
                            placeholder="Filter by name"
                            value={filter}
                            onChange={(e) => {
                                setFilter(e.target.value);
                                setPage(0);
                            }}
                            className="h-8 w-48"
                        />
                    </div>
                    <TabsContent
                        value={tab}
                        className="border-border min-h-0 flex-1 overflow-y-auto rounded-md border font-mono text-xs"
                    >
                        {pageRows.length === 0 ? (
                            <p className="text-muted-foreground p-4 text-center font-sans">
                                No {tab} vendors{needle ? " match that filter" : ""}.
                            </p>
                        ) : tab === "changed" ? (
                            (pageRows as VendorChange[]).map((c) => (
                                <ChangedRow key={c.supplierName} change={c} />
                            ))
                        ) : (
                            (pageRows as VendorRecord[]).map((v) => (
                                <WholeRow key={v.supplierName} vendor={v} kind={tab} />
                            ))
                        )}
                    </TabsContent>
                    {pageCount > 1 ? (
                        <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page === 0}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </Button>
                            Page {page + 1} of {pageCount}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={page >= pageCount - 1}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    ) : null}
                </Tabs>
            )}

            <DialogFooter>
                <Button variant="outline" onClick={onCancel} disabled={busy}>
                    Cancel
                </Button>
                <Button onClick={onApply} disabled={busy || total === 0}>
                    {busy ? "Applying..." : `Apply ${total.toLocaleString()} changes`}
                </Button>
            </DialogFooter>
        </>
    );
}

// An added (+, green) or removed (-, red) vendor with all of its data.
function WholeRow({ vendor, kind }: { vendor: VendorRecord; kind: "added" | "removed" }) {
    const added = kind === "added";
    return (
        <div
            className={cn(
                "border-border flex gap-3 border-b px-3 py-2 last:border-b-0",
                added ? "bg-emerald-600/5" : "bg-destructive/5"
            )}
        >
            <span
                className={cn(
                    "select-none",
                    added ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                )}
            >
                {added ? "+" : "-"}
            </span>
            <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">{vendor.supplierName}</p>
                {FIELD_ORDER.filter((f) => vendor[f] != null).map((f) => (
                    <p key={f} className="text-muted-foreground break-words whitespace-pre-line">
                        {FIELD_LABELS[f]}: <span className="text-foreground">{vendor[f]}</span>
                    </p>
                ))}
            </div>
        </div>
    );
}

// A changed vendor: only the fields that differ, old struck through in red and
// new in green.
function ChangedRow({ change }: { change: VendorChange }) {
    return (
        <div className="border-border flex gap-3 border-b px-3 py-2 last:border-b-0">
            <span className="text-amber-700 select-none dark:text-amber-400">~</span>
            <div className="min-w-0 space-y-0.5">
                <p className="font-semibold">{change.supplierName}</p>
                {change.fields.map((f) => (
                    <div key={f} className="flex flex-wrap gap-x-2">
                        <span className="text-muted-foreground">{FIELD_LABELS[f]}:</span>
                        <span className="text-destructive break-words whitespace-pre-line line-through">
                            {change.before[f] ?? "(blank)"}
                        </span>
                        <span className="text-muted-foreground">to</span>
                        <span className="break-words whitespace-pre-line text-emerald-700 dark:text-emerald-400">
                            {change.after[f] ?? "(blank)"}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
