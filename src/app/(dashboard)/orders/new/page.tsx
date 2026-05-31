import { asc } from "drizzle-orm";
import Link from "next/link";

import { OrderForm } from "@/components/orders/OrderForm";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { team } from "@/lib/db/schema";

export default async function NewOrderPage() {
    const teams = db.select().from(team).orderBy(asc(team.name)).all();

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">New Order</h1>
                    <p className="text-muted-foreground">Submit a parts order for admin review.</p>
                </div>
                <Button variant="outline" render={<Link href="/orders" />}>
                    Back
                </Button>
            </div>

            <OrderForm teams={teams} />
        </div>
    );
}
