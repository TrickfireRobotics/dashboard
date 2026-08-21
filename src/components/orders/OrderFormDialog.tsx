"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { OrderForm } from "./OrderForm";

export function OrderFormDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
                <Plus className="size-4" />
                Submit order
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Submit order</DialogTitle>
                    <DialogDescription>
                        Submit a purchase request for officer approval.
                    </DialogDescription>
                </DialogHeader>
                <OrderForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
