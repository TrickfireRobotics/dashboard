import { DollarSign, Gamepad2, KeyRound, Network, Package, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LiveClock } from "@/components/dashboard/LiveClock";
import { MinecraftStatusTile } from "@/components/dashboard/MinecraftStatusTile";
import { NetworkStatusTile } from "@/components/dashboard/NetworkStatusTile";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";

const quickLinks = [
    {
        href: "/orders",
        label: "Orders",
        description: "Submit and track parts requests.",
        icon: Package,
    },
    {
        href: "/minecraft",
        label: "Minecraft",
        description: "Server status and whitelist.",
        icon: Gamepad2,
    },
    {
        href: "/network",
        label: "Network",
        description: "Private VPN device access.",
        icon: Network,
    },
    {
        href: "/members",
        label: "Members",
        description: "Approvals and org access.",
        icon: Users,
    },
    {
        href: "/finance",
        label: "Finance",
        description: "Budgets and gift fund.",
        icon: DollarSign,
    },
    {
        href: "/api-keys",
        label: "API Keys",
        description: "Shared credentials vault.",
        icon: KeyRound,
    },
];

export default async function DashboardHome() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const firstName = sessionUser.name?.split(" ")[0] ?? "there";

    return (
        <div className="space-y-10">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1>Welcome back, {firstName}</h1>
                    <p className="text-muted-foreground">Your TrickFire club dashboard.</p>
                </div>
                <LiveClock />
            </div>

            <section className="space-y-4">
                <div>
                    <h2>Live Status</h2>
                    <p className="text-muted-foreground text-sm">
                        What&apos;s up right now on the club&apos;s shared infrastructure.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Link href="/minecraft">
                        <Card className="hover:border-primary/40 h-full transition-all">
                            <div className="text-muted-foreground flex items-center gap-2 px-4 pt-4 text-xs font-medium tracking-wider uppercase">
                                <Gamepad2 className="size-3.5" />
                                Minecraft
                            </div>
                            <MinecraftStatusTile />
                        </Card>
                    </Link>

                    <Link href="/network">
                        <Card className="hover:border-primary/40 h-full transition-all">
                            <div className="text-muted-foreground flex items-center gap-2 px-4 pt-4 text-xs font-medium tracking-wider uppercase">
                                <Network className="size-3.5" />
                                Network
                            </div>
                            <NetworkStatusTile />
                        </Card>
                    </Link>
                </div>
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
