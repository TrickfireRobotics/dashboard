"use client";

import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/orders": "Orders",
    "/api-keys": "API Keys",
    "/minecraft": "Minecraft",
    "/network": "Network",
    "/admin/orders": "Order Queue",
    "/admin/users": "Users",
    "/admin/minecraft": "Whitelist",
    "/admin/server": "Server",
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

export function TopNav() {
    const pathname = usePathname();
    const title = getPageTitle(pathname);

    return (
        <header className="border-border flex h-16 items-center border-b px-6">
            {title && <h1 className="text-foreground text-lg font-semibold">{title}</h1>}
        </header>
    );
}
