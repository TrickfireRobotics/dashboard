"use client";

import {
    DollarSign,
    Gamepad2,
    KeyRound,
    LayoutDashboard,
    Network,
    Package,
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

export const mainNav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/minecraft", label: "Minecraft", icon: Gamepad2 },
    { href: "/network", label: "Network", icon: Network },
    { href: "/members", label: "Members", icon: Users },
    { href: "/finance", label: "Finance", icon: DollarSign },
    { href: "/api-keys", label: "API Keys", icon: KeyRound },
];

const EXACT = new Set(["/dashboard"]);

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
            {mainNav.map((item) => (
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
