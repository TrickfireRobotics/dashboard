"use client";

import {
    ClipboardList,
    Gamepad2,
    KeyRound,
    LayoutDashboard,
    Package,
    Server,
    Shield,
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

const memberNav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/api-keys", label: "API Keys", icon: KeyRound },
    { href: "/minecraft", label: "Minecraft", icon: Gamepad2 },
];

const adminNav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: Shield },
    { href: "/admin/orders", label: "Order Queue", icon: ClipboardList },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/minecraft", label: "Whitelist", icon: Server },
];

const EXACT = new Set(["/dashboard", "/admin"]);

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
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

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        pathname === href || (!EXACT.has(href) && pathname.startsWith(`${href}/`));

    return (
        <aside className="border-sidebar-border bg-sidebar hidden w-60 shrink-0 flex-col border-r md:flex">
            <div className="border-sidebar-border flex h-16 items-center border-b px-5">
                <span className="text-primary text-2xl">TrickFire</span>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {memberNav.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(item.href)} />
                ))}

                {isAdmin ? (
                    <>
                        <p className="text-muted-foreground mt-5 mb-1 px-3 text-xs tracking-wider uppercase">
                            Admin
                        </p>
                        {adminNav.map((item) => (
                            <NavLink key={item.href} item={item} active={isActive(item.href)} />
                        ))}
                    </>
                ) : null}
            </nav>
        </aside>
    );
}
