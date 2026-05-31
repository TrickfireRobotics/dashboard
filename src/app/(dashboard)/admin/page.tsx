import { count, eq } from "drizzle-orm";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { minecraftWhitelist, order, user } from "@/lib/db/schema";

function countWhere(table: typeof order | typeof user | typeof minecraftWhitelist) {
    return db.select({ value: count() }).from(table);
}

export default function AdminOverviewPage() {
    const pendingOrders = countWhere(order).where(eq(order.status, "pending")).get()?.value ?? 0;
    const activeMembers = countWhere(user).where(eq(user.isActive, true)).get()?.value ?? 0;
    const openWhitelist =
        countWhere(minecraftWhitelist).where(eq(minecraftWhitelist.status, "pending")).get()
            ?.value ?? 0;

    const stats = [
        { label: "Pending orders", value: pendingOrders, href: "/admin/orders" },
        { label: "Active members", value: activeMembers, href: "/admin/users" },
        {
            label: "Open whitelist requests",
            value: openWhitelist,
            href: "/admin/minecraft",
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Admin Overview</h1>
                <p className="text-muted-foreground">Club-wide management and stats.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((s) => (
                    <Link key={s.href} href={s.href}>
                        <Card className="hover:border-primary/60 transition-colors">
                            <CardHeader>
                                <CardTitle className="text-primary text-4xl">{s.value}</CardTitle>
                                <CardDescription>{s.label}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
