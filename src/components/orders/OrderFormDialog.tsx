"use client";

import { ListPlus, Plus } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { OrderForm } from "./OrderForm";

type Mode = "single" | "multiple";

export function OrderFormDialog() {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>("single");
    const [sessionKey, setSessionKey] = useState(0);

    function openDialog(nextMode: Mode) {
        setMode(nextMode);
        setSessionKey((k) => k + 1);
        setOpen(true);
    }

    // Lets the form widen the dialog itself if someone starts with "Submit
    // item" and then adds a second row, instead of being stuck in a cramped
    // grid until they close and reopen with "Submit multiple".
    const handleLayoutChange = useCallback((multiple: boolean) => {
        setMode(multiple ? "multiple" : "single");
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex flex-wrap gap-2">
                <DialogTrigger render={<Button />} onClick={() => openDialog("single")}>
                    <Plus className="size-4" />
                    Submit item
                </DialogTrigger>
                <DialogTrigger
                    render={<Button variant="outline" />}
                    onClick={() => openDialog("multiple")}
                >
                    <ListPlus className="size-4" />
                    Submit multiple
                </DialogTrigger>
            </div>
            <DialogContent
                className={cn(
                    "max-h-[85vh] overflow-y-auto",
                    mode === "multiple" ? "sm:max-w-6xl" : "sm:max-w-2xl"
                )}
            >
                <DialogHeader>
                    <DialogTitle>
                        {mode === "multiple" ? "Submit multiple orders" : "Submit order"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "multiple"
                            ? "Submit several purchase requests at once for officer approval. Review everything before sending."
                            : "Submit a purchase request for officer approval."}
                    </DialogDescription>
                </DialogHeader>
                <OrderForm
                    key={sessionKey}
                    initialItemCount={mode === "multiple" ? 2 : 1}
                    onSuccess={() => setOpen(false)}
                    onLayoutChange={handleLayoutChange}
                />
            </DialogContent>
        </Dialog>
    );
}
