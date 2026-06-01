import { and, count, eq } from "drizzle-orm";
import { Gamepad2, KeyRound, Network, Package } from "lucide-react";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { headscaleJoinRequest, minecraftWhitelist, order, user, userFeature } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

const tiles = [
    {
        href: "/orders/new",
        title: "Order a Part",
        description: "Submit a parts order for review.",
        icon: Package,
    },
    {
        href: "/api-keys",
        title: "API Keys",
        description: "Create keys for your sim scripts.",
        icon: KeyRound,
    },
    {
        href: "/minecraft",
        title: "Minecraft",
        description: "Server status and whitelist requests.",
        icon: Gamepad2,
    },
    {
        href: "/headscale",
        title: "Network",
        description: "Private network status and access.",
        icon: Network,
    },
];

export default async function DashboardHome() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const firstName = sessionUser.name?.split(" ")[0] ?? "there";
    const isAdmin = sessionUser.role === "admin";

    let adminStats: { label: string; value: number; href: string }[] = [];
    if (isAdmin) {
        const pendingOrders =
            db.select({ value: count() }).from(order).where(eq(order.status, "pending")).get()
                ?.value ?? 0;
        const pendingApprovals =
            db.select({ value: count() }).from(user).where(eq(user.approved, false)).get()?.value ??
            0;
        const activeMembers =
            db.select({ value: count() }).from(user).where(and(eq(user.isActive, true), eq(user.approved, true))).get()?.value ??
            0;
        const pendingFeatureRequests =
            db.select({ value: count() }).from(userFeature).where(eq(userFeature.status, "pending")).get()?.value ??
            0;
        const openWhitelist =
            db
                .select({ value: count() })
                .from(minecraftWhitelist)
                .where(eq(minecraftWhitelist.status, "pending"))
                .get()?.value ?? 0;
        const pendingNetworkRequests =
            db
                .select({ value: count() })
                .from(headscaleJoinRequest)
                .where(eq(headscaleJoinRequest.status, "pending"))
                .get()?.value ?? 0;

        adminStats = [
            { label: "Pending approvals", value: pendingApprovals, href: "/admin/users" },
            { label: "Pending orders", value: pendingOrders, href: "/admin/orders" },
            { label: "Feature requests", value: pendingFeatureRequests, href: "/admin/users" },
            { label: "Active members", value: activeMembers, href: "/admin/users" },
            { label: "Open whitelist requests", value: openWhitelist, href: "/admin/minecraft" },
            {
                label: "Network join requests",
                value: pendingNetworkRequests,
                href: "/admin/headscale",
            },
        ];
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl">Welcome, {firstName}</h1>
                <p className="text-muted-foreground">Your TrickFire club dashboard.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <Link key={tile.href} href={tile.href}>
                            <Card className="hover:border-primary/60 h-full transition-colors">
                                <CardHeader>
                                    <Icon className="text-primary size-6" />
                                    <CardTitle className="mt-2">{tile.title}</CardTitle>
                                    <CardDescription>{tile.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {isAdmin && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl font-medium">Admin Overview</h2>
                        <p className="text-muted-foreground text-sm">
                            Club-wide stats at a glance.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {adminStats.map((s) => (
                            <Link key={s.label} href={s.href}>
                                <Card className="hover:border-primary/60 transition-colors">
                                    <CardHeader>
                                        <CardTitle className="text-primary text-4xl">
                                            {s.value}
                                        </CardTitle>
                                        <CardDescription>{s.label}</CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
