import { count, eq } from "drizzle-orm";
import {
    CheckCircle2,
    ChevronRight,
    DollarSign,
    Gamepad2,
    KeyRound,
    Network,
    Package,
    ShoppingCart,
    UserCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LiveClock } from "@/components/dashboard/LiveClock";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db";
import { minecraftWhitelist, order, user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "Still up, ";
    if (hour < 12) return "Good morning, ";
    if (hour < 17) return "Good afternoon, ";
    if (hour < 21) return "Good evening, ";
    return "Working late, ";
}

const quickLinks = [
    {
        href: "/orders",
        label: "Orders",
        description: "Submit and track parts requests.",
        icon: Package,
    },
    {
        href: "/finance",
        label: "Finance",
        description: "Budgets and gift fund.",
        icon: DollarSign,
    },
    {
        href: "/members",
        label: "Members",
        description: "Approvals and org access.",
        icon: UserCheck,
    },
    {
        href: "/api-keys",
        label: "API Keys",
        description: "Shared credentials vault.",
        icon: KeyRound,
    },
    {
        href: "/network",
        label: "Network",
        description: "Tailscale network for server maintnance.",
        icon: Network,
    },
    {
        href: "/minecraft",
        label: "Minecraft",
        description: "Server status and whitelist.",
        icon: Gamepad2,
    },
];

export default async function DashboardHome() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const firstName = sessionUser.name?.split(" ")[0] ?? "there";

    const pendingOrders =
        db.select({ value: count() }).from(order).where(eq(order.status, "pending")).get()?.value ??
        0;
    const approvedOrders =
        db.select({ value: count() }).from(order).where(eq(order.status, "approved")).get()
            ?.value ?? 0;
    const pendingApprovals =
        db.select({ value: count() }).from(user).where(eq(user.approved, false)).get()?.value ?? 0;
    const openWhitelist =
        db
            .select({ value: count() })
            .from(minecraftWhitelist)
            .where(eq(minecraftWhitelist.status, "pending"))
            .get()?.value ?? 0;

    const actionItems = [
        {
            count: pendingOrders,
            label: "orders need triage or approval",
            href: "/orders",
            icon: Package,
        },
        {
            count: approvedOrders,
            label: "approved orders are awaiting purchase",
            href: "/orders",
            icon: ShoppingCart,
        },
        {
            count: pendingApprovals,
            label: "members are waiting for approval",
            href: "/members",
            icon: UserCheck,
        },
        {
            count: openWhitelist,
            label: "whitelist requests need review",
            href: "/minecraft",
            icon: Gamepad2,
        },
    ].filter((item) => item.count > 0);

    return (
        <div className="space-y-10">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl">
                    {getGreeting()}
                    <span className="from-primary to-secondary bg-linear-to-r bg-clip-text text-transparent">
                        {firstName}
                    </span>
                </h1>
                <LiveClock />
            </div>

            <section className="space-y-4">
                <div>
                    <h2>Action Items</h2>
                    <p className="text-muted-foreground text-sm">
                        Things that need your attention.
                    </p>
                </div>
                {actionItems.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="All caught up — nothing needs action." />
                ) : (
                    <div className="divide-border border-border divide-y rounded-lg border">
                        {actionItems.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="hover:bg-muted/40 flex items-center gap-4 px-4 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg"
                            >
                                <div className="bg-secondary/10 flex size-9 shrink-0 items-center justify-center rounded-full">
                                    <item.icon className="text-secondary size-4.5" />
                                </div>
                                <p className="text-foreground min-w-0 flex-1 text-sm">
                                    <span className="font-heading font-semibold tabular-nums">
                                        {item.count}
                                    </span>{" "}
                                    {item.label}
                                </p>
                                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <div>
                    <h2>Quick Access</h2>
                    <p className="text-muted-foreground text-sm">Jump to common tools.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {quickLinks.map(({ href, label, description, icon: Icon }) => (
                        <Link key={href} href={href}>
                            <Card className="hover:border-primary/40 h-full transition-all">
                                <CardHeader>
                                    <div className="bg-primary/10 mb-3 flex h-9 w-9 items-center justify-center rounded-xl">
                                        <Icon className="text-primary size-4.5" />
                                    </div>
                                    <CardTitle>{label}</CardTitle>
                                    <CardDescription>{description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
