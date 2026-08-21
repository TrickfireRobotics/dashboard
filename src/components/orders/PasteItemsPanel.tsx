"use client";

import { ClipboardPaste } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ParsedItem = {
    itemName: string;
    vendor: string;
    link: string;
    partNumber: string;
    quantity: string;
    unitCost: string;
};

const COLUMNS = ["Item name", "Vendor", "Link", "Part #", "Qty", "Unit cost"] as const;

function stripCurrency(value: string): string {
    return value.replace(/[$,\s]/g, "");
}

// Accepts rows copied straight out of a spreadsheet (tab-separated) or typed as
// comma-separated text, in the column order shown to the user.
export function parseItemRows(text: string): ParsedItem[] {
    const items: ParsedItem[] = [];

    for (const rawLine of text.split(/\r?\n/)) {
        if (!rawLine.trim()) continue;

        // Split the untrimmed line: a leading empty cell is meaningful, and
        // trimming it away would shift every later column one to the left.
        const cells = (rawLine.includes("\t") ? rawLine.split("\t") : rawLine.split(",")).map((c) =>
            c.trim()
        );

        // Skip a pasted header row.
        if (cells[0] && /^item(\s|_)?name$/i.test(cells[0])) continue;

        const [itemName = "", vendor = "", link = "", partNumber = "", qty = "", cost = ""] = cells;
        if (!itemName) continue;

        const quantity = /^\d+$/.test(qty) ? qty : "1";
        const unitCostRaw = stripCurrency(cost);
        const unitCost =
            unitCostRaw && !Number.isNaN(Number(unitCostRaw)) && Number(unitCostRaw) > 0
                ? unitCostRaw
                : "";

        items.push({ itemName, vendor, link, partNumber, quantity, unitCost });
    }

    return items;
}

export function PasteItemsPanel({ onAdd }: { onAdd: (items: ParsedItem[]) => void }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");

    const parsed = parseItemRows(text);

    function handleAdd() {
        if (parsed.length === 0) return;
        onAdd(parsed);
        setText("");
        setOpen(false);
    }

    if (!open) {
        return (
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                <ClipboardPaste className="size-4" />
                Paste a list
            </Button>
        );
    }

    return (
        <div className="border-border bg-muted/30 w-full space-y-3 rounded-lg border p-4">
            <div>
                <Label htmlFor="paste-items">Paste rows from a spreadsheet</Label>
                <p className="text-muted-foreground mt-1 text-sm">
                    One item per line, in this order: {COLUMNS.join(" · ")}. Tab or comma separated.
                    Only the item name is required — fill the rest in after adding.
                </p>
            </div>
            <Textarea
                id="paste-items"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                    "1/4-20 hex bolt\tMcMaster-Carr\thttps://mcmaster.com/91251A542\t91251A542\t25\t0.42"
                }
                className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
                <Button type="button" onClick={handleAdd} disabled={parsed.length === 0}>
                    Add {parsed.length > 0 ? parsed.length : ""}{" "}
                    {parsed.length === 1 ? "item" : "items"}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                        setText("");
                        setOpen(false);
                    }}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}
