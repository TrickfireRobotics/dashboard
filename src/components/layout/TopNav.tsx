"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "./MobileNav";

type RouteMeta = { label: string; description?: string };

const routeMeta: Record<string, RouteMeta> = {
    "/dashboard": { label: "Dashboard", description: "Your TrickFire club dashboard" },
    "/orders": { label: "Orders", description: "Track orders and manage the team queue" },
    "/orders/new": {
        label: "New Order",
        description: "Submit a purchase request for officer approval",
    },
    "/api-keys": { label: "API Keys", description: "Shared credentials vault" },
    "/minecraft": { label: "Minecraft", description: "Server status and whitelist" },
    "/network": { label: "Network", description: "TrickFire private network" },
    "/members": { label: "Members", description: "Approvals, accounts, and org access" },
    "/finance": { label: "Finance", description: "Budgets, gift fund, and pricing" },
    "/settings": { label: "Account Settings", description: "Update your name and email address" },
};

const EDIT_ORDER_RE = /^\/orders\/[^/]+\/edit$/;

function getRouteMeta(pathname: string): RouteMeta | null {
    if (routeMeta[pathname]) return routeMeta[pathname];
    if (EDIT_ORDER_RE.test(pathname)) {
        return { label: "Edit Order", description: "Update your order before it's reviewed" };
    }
    for (const [route, meta] of Object.entries(routeMeta)) {
        if (pathname.startsWith(route + "/")) return meta;
    }
    return null;
}

export function TopNav({ name, email }: { name: string; email: string }) {
    const pathname = usePathname();
    const meta = getRouteMeta(pathname);

    return (
        <header className="border-border flex h-16 items-center gap-3 border-b px-6">
            <MobileNav name={name} email={email} />
            {meta && (
                <div className="flex min-w-0 items-baseline gap-3">
                    <h1 className="text-foreground shrink-0 text-lg font-semibold">{meta.label}</h1>
                    {meta.description && (
                        <span className="text-muted-foreground hidden truncate text-sm sm:inline">
                            {meta.description}
                        </span>
                    )}
                </div>
            )}
        </header>
    );
}
