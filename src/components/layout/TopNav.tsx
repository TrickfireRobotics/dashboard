"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "./MobileNav";
import type { FeatureKey } from "@/lib/features";

const routeLabels: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/features": "My Access",
    "/orders": "Orders",
    "/api-keys": "API Keys",
    "/minecraft": "Minecraft",
    "/network": "Network",
    "/admin": "Admin",
    "/admin/orders": "Order Queue",
    "/admin/finance": "Finance",
    "/admin/users": "Users",
    "/admin/minecraft": "Whitelist",
    "/admin/server": "Server",
    "/admin/github": "Github",
    "/admin/network": "Network",
    "/admin/onshape": "Onshape",
};

function getPageTitle(pathname: string): string {
    if (routeLabels[pathname]) return routeLabels[pathname];
    for (const [route, label] of Object.entries(routeLabels)) {
        if (pathname.startsWith(route + "/")) return label;
    }
    return "";
}

export function TopNav({
    isAdmin,
    canAccessVault,
    name,
    email,
    grantedFeatures,
}: {
    isAdmin: boolean;
    canAccessVault: boolean;
    name: string;
    email: string;
    grantedFeatures: FeatureKey[];
}) {
    const pathname = usePathname();
    const title = getPageTitle(pathname);

    return (
        <header className="border-border flex h-16 items-center gap-3 border-b px-6">
            <MobileNav
                isAdmin={isAdmin}
                canAccessVault={canAccessVault}
                name={name}
                email={email}
                grantedFeatures={grantedFeatures}
            />
            {title && <h1 className="text-foreground text-lg font-semibold">{title}</h1>}
        </header>
    );
}
