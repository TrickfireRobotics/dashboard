import Link from "next/link";

import { OrderForm } from "@/components/orders/OrderForm";
import { Button } from "@/components/ui/button";

export default function NewOrderPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button variant="outline" nativeButton={false} render={<Link href="/orders" />}>
                    Back
                </Button>
            </div>

            <OrderForm />
        </div>
    );
}
