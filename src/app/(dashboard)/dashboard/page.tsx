import { and, count, eq } from "drizzle-orm";
import { AlertTriangle, Gamepad2, KeyRound, Network, Package } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LiveClock } from "@/components/dashboard/LiveClock";
import { MinecraftStatusTile } from "@/components/dashboard/MinecraftStatusTile";
import { NetworkStatusTile } from "@/components/dashboard/NetworkStatusTile";
import { SystemVitals } from "@/components/dashboard/SystemVitals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { networkJoinRequest, minecraftWhitelist, order, user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export default async function DashboardHome() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const firstName = sessionUser.name?.split(" ")[0] ?? "there";

    const pendingOrders =
        db.select({ value: count() }).from(order).where(eq(order.status, "pending")).get()?.value ??
        0;
    const pendingApprovals =
        db.select({ value: count() }).from(user).where(eq(user.approved, false)).get()?.value ?? 0;
    const activeMembers =
        db
            .select({ value: count() })
            .from(user)
            .where(and(eq(user.isActive, true), eq(user.approved, true)))
            .get()?.value ?? 0;
    const openWhitelist =
        db
            .select({ value: count() })
            .from(minecraftWhitelist)
            .where(eq(minecraftWhitelist.status, "pending"))
            .get()?.value ?? 0;
    const pendingNetworkRequests =
        db
            .select({ value: count() })
            .from(networkJoinRequest)
            .where(eq(networkJoinRequest.status, "pending"))
            .get()?.value ?? 0;

    const adminStats = [
        { label: "Pending approvals", value: pendingApprovals, href: "/admin/users" },
        { label: "Pending orders", value: pendingOrders, href: "/admin/orders" },
        { label: "Active members", value: activeMembers, href: "/admin/users" },
        { label: "Open whitelist requests", value: openWhitelist, href: "/admin/minecraft" },
        {
            label: "Network join requests",
            value: pendingNetworkRequests,
            href: "/admin/network",
        },
    ];

    const urgentItems = adminStats.filter((s) => s.value > 0 && s.label !== "Active members");

    return (
        <div className="space-y-10">
            {/* Hero row */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1>Welcome back, {firstName}</h1>
                    <p className="text-muted-foreground">Your TrickFire club dashboard.</p>
                </div>
                <LiveClock />
            </div>

            {/* Admin alert strip */}
            {urgentItems.length > 0 && (
                <div className="border-secondary/30 bg-secondary/5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
                    <AlertTriangle className="text-secondary size-4 shrink-0" />
                    {urgentItems.map((item) => (
                        <Link key={item.label} href={item.href}>
                            <Badge variant="secondary">
                                {item.value} {item.label} →
                            </Badge>
                        </Link>
                    ))}
                </div>
            )}

            {/* Server Health */}
            <section className="space-y-4">
                <div>
                    <h2>Server Health</h2>
                    <p className="text-muted-foreground text-sm">
                        Live system vitals — updates every 10s
                    </p>
                </div>
                <SystemVitals />
            </section>

            {/* Quick Access — bento layout */}
            <section className="space-y-4">
                <div>
                    <h2>Quick Access</h2>
                    <p className="text-muted-foreground text-sm">Jump to common tools.</p>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row">
                    {/* Orders spotlight — left 2/3 on desktop */}
                    <Link href="/orders/new" className="lg:flex-[2]">
                        <Card
                            className="hover:border-primary/50 h-full transition-all hover:shadow-[0_0_24px_rgba(0,254,0,0.10)]"
                            style={{
                                background:
                                    "linear-gradient(135deg, var(--card) 60%, rgba(0,254,0,0.07) 100%)",
                            }}
                        >
                            <CardHeader className="pb-3">
                                <div className="bg-primary/10 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                                    <Package className="text-primary size-7" />
                                </div>
                                <div className="flex items-start justify-between gap-3">
                                    <CardTitle className="font-heading text-2xl">
                                        Order a Part
                                    </CardTitle>
                                    {pendingOrders > 0 && (
                                        <Badge variant="secondary" className="shrink-0">
                                            {pendingOrders} pending
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription>
                                    Submit a parts request for the team. Orders are tracked from
                                    submission through approval and delivery.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-primary text-sm font-medium">New order →</p>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Right column — 3 stacked tiles */}
                    <div className="grid grid-cols-2 gap-4 lg:flex lg:flex-[1] lg:flex-col">
                        {/* Minecraft live tile */}
                        <Link href="/minecraft">
                            <Card className="hover:border-primary/40 h-full transition-all">
                                <div className="text-muted-foreground flex items-center gap-2 px-4 pt-4 text-xs font-medium tracking-wider uppercase">
                                    <Gamepad2 className="size-3.5" />
                                    Minecraft
                                </div>
                                <MinecraftStatusTile />
                            </Card>
                        </Link>

                        {/* Network live tile */}
                        <Link href="/network">
                            <Card className="hover:border-primary/40 h-full transition-all">
                                <div className="text-muted-foreground flex items-center gap-2 px-4 pt-4 text-xs font-medium tracking-wider uppercase">
                                    <Network className="size-3.5" />
                                    Network
                                </div>
                                <NetworkStatusTile />
                            </Card>
                        </Link>

                        {/* API Keys pink accent tile — full width in the 2-col grid on mobile */}
                        <Link href="/api-keys" className="col-span-2 lg:col-span-1">
                            <Card className="hover:bg-secondary/10 hover:border-secondary/40 border-secondary/20 bg-secondary/5 h-full transition-all hover:shadow-[0_0_16px_rgba(233,60,172,0.10)]">
                                <CardHeader>
                                    <div className="bg-secondary/10 mb-3 flex h-9 w-9 items-center justify-center rounded-xl">
                                        <KeyRound className="text-secondary size-4.5" />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <CardTitle>API Keys</CardTitle>
                                        <Badge variant="outline" className="text-xs">
                                            Developer Tool
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        Create keys for your sim scripts.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Admin Overview */}
            {
                <section className="space-y-4">
                    <div>
                        <h2>Admin Overview</h2>
                        <p className="text-muted-foreground text-sm">
                            Club-wide stats at a glance.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {adminStats.map((s) => {
                            const isUrgent = s.value > 0 && s.label !== "Active members";
                            const isPositive = s.label === "Active members";
                            return (
                                <Link key={s.label} href={s.href}>
                                    <Card
                                        className={`hover:border-primary/40 transition-all ${
                                            isUrgent
                                                ? "border-l-secondary border-l-2 hover:shadow-[0_0_12px_rgba(233,60,172,0.08)]"
                                                : ""
                                        }`}
                                    >
                                        <CardHeader>
                                            <CardTitle
                                                className={`font-heading text-5xl leading-none tabular-nums ${
                                                    isUrgent
                                                        ? "text-secondary"
                                                        : isPositive
                                                          ? "text-primary"
                                                          : "text-muted-foreground"
                                                }`}
                                            >
                                                {s.value}
                                            </CardTitle>
                                            {isUrgent && (
                                                <p className="text-secondary/70 font-heading text-xs tracking-widest uppercase">
                                                    Action needed
                                                </p>
                                            )}
                                            <CardDescription>{s.label}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            }
        </div>
    );
}
