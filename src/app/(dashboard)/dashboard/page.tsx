import { Gamepad2, KeyRound, Package } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

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
];

export default async function DashboardHome() {
    const session = await auth.api.getSession({ headers: await headers() });
    const firstName = session?.user.name?.split(" ")[0] ?? "there";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Welcome, {firstName}</h1>
                <p className="text-muted-foreground">Your TrickFire club dashboard.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
    );
}
