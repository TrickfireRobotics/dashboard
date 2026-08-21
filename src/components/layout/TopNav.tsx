"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "./MobileNav";

const routeLabels: Record<string, string> = {
    "/dashboard": "Dashboard",
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

export function TopNav({ name, email }: { name: string; email: string }) {
    const pathname = usePathname();
    const title = getPageTitle(pathname);

    return (
        <header className="border-border flex h-16 items-center gap-3 border-b px-6">
            <MobileNav name={name} email={email} />
            {title && <h1 className="text-foreground text-lg font-semibold">{title}</h1>}
        </header>
    );
}
