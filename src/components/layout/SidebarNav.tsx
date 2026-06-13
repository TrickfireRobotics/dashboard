"use client";

import {
    Boxes,
    ClipboardList,
    Gamepad2,
    GitBranch,
    KeyRound,
    LayoutDashboard,
    Lock,
    Network,
    Package,
    Server,
    Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/lib/features";

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};

type FeatureNavItem = NavItem & { feature: FeatureKey };

export const baseNav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/features", label: "My Access", icon: Lock },
];

export const featureNav: FeatureNavItem[] = [
    { href: "/orders", label: "Orders", icon: Package, feature: "orders" },
    { href: "/minecraft", label: "Minecraft", icon: Gamepad2, feature: "minecraft" },
    { href: "/network", label: "Network", icon: Network, feature: "network" },
];

export const vaultNav: NavItem = { href: "/api-keys", label: "API Keys", icon: KeyRound };

export const adminNav: NavItem[] = [
    { href: "/admin/orders", label: "Order Queue", icon: ClipboardList },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/minecraft", label: "Whitelist", icon: Server },
    { href: "/admin/server", label: "Server", icon: Gamepad2 },
    { href: "/admin/github", label: "GitHub", icon: GitBranch },
    { href: "/admin/network", label: "Network", icon: Network },
    { href: "/admin/onshape", label: "Onshape", icon: Boxes },
];

const EXACT = new Set(["/dashboard", "/admin"]);

export function NavLink({
    item,
    active,
    onClick,
}: {
    item: NavItem;
    active: boolean;
    onClick?: () => void;
}) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
        >
            <Icon className="size-4 shrink-0" />
            {item.label}
        </Link>
    );
}

export function NavContent({
    isAdmin,
    canAccessVault,
    grantedFeatures,
    onLinkClick,
}: {
    isAdmin: boolean;
    canAccessVault: boolean;
    grantedFeatures: FeatureKey[];
    onLinkClick?: () => void;
}) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        pathname === href || (!EXACT.has(href) && pathname.startsWith(`${href}/`));

    const visibleFeatureNav = featureNav.filter((item) => grantedFeatures.includes(item.feature));

    return (
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {baseNav.map((item) => (
                <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onClick={onLinkClick}
                />
            ))}

            {visibleFeatureNav.map((item) => (
                <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onClick={onLinkClick}
                />
            ))}

            {canAccessVault ? (
                <NavLink item={vaultNav} active={isActive(vaultNav.href)} onClick={onLinkClick} />
            ) : null}

            {isAdmin ? (
                <>
                    <p className="text-muted-foreground mt-5 mb-1 px-3 text-xs tracking-wider uppercase">
                        Admin
                    </p>
                    {adminNav.map((item) => (
                        <NavLink
                            key={item.href}
                            item={item}
                            active={isActive(item.href)}
                            onClick={onLinkClick}
                        />
                    ))}
                </>
            ) : null}
        </nav>
    );
}
