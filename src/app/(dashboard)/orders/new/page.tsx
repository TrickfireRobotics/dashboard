import Link from "next/link";

import { OrderForm } from "@/components/orders/OrderForm";
import { Button } from "@/components/ui/button";

export default function NewOrderPage() {
    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">New Order</h1>
                    <p className="text-muted-foreground">
                        Submit a purchase request for officer approval.
                    </p>
                </div>
                <Button variant="outline" render={<Link href="/orders" />}>
                    Back
                </Button>
            </div>

            <OrderForm />
        </div>
    );
}
