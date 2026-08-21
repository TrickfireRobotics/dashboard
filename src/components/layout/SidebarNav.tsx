"use client";

import {
    Boxes,
    ClipboardList,
    DollarSign,
    Gamepad2,
    GitBranch,
    KeyRound,
    LayoutDashboard,
    Network,
    Package,
    Server,
    Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};

export const baseNav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export const featureNav: NavItem[] = [
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/minecraft", label: "Minecraft", icon: Gamepad2 },
    { href: "/network", label: "Network", icon: Network },
];

export const vaultNav: NavItem = { href: "/api-keys", label: "API Keys", icon: KeyRound };

export const adminNav: NavItem[] = [
    { href: "/admin/orders", label: "Order Queue", icon: ClipboardList },
    { href: "/admin/finance", label: "Finance", icon: DollarSign },
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

export function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        pathname === href || (!EXACT.has(href) && pathname.startsWith(`${href}/`));

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

            {featureNav.map((item) => (
                <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onClick={onLinkClick}
                />
            ))}

            <NavLink item={vaultNav} active={isActive(vaultNav.href)} onClick={onLinkClick} />

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
        </nav>
    );
}
