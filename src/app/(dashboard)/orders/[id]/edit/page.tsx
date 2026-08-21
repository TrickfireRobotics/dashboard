import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderForm } from "@/components/orders/OrderForm";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { order } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function EditOrderPage({ params }: PageProps) {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const orderId = Number((await params).id);
    if (!Number.isInteger(orderId)) notFound();

    const existing = db
        .select()
        .from(order)
        .where(and(eq(order.id, orderId), eq(order.userId, user.id)))
        .get();

    if (!existing) notFound();
    if (existing.status === "approved" || existing.status === "ordered") {
        redirect("/orders");
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">Edit Order</h1>
                    <p className="text-muted-foreground">
                        {existing.status === "denied"
                            ? "Update your order and resubmit it for officer review."
                            : "Update your pending order before it is reviewed."}
                    </p>
                </div>
                <Button variant="outline" nativeButton={false} render={<Link href="/orders" />}>
                    Back
                </Button>
            </div>

            <OrderForm
                initialOrder={{
                    id: existing.id,
                    status: existing.status,
                    vendor: existing.vendor,
                    link: existing.link,
                    itemName: existing.itemName,
                    partNumber: existing.partNumber,
                    quantity: existing.quantity,
                    unitCostCents: existing.unitCostCents,
                    notes: existing.notes,
                }}
            />
        </div>
    );
}
