"use client";

import {
    ClipboardList,
    Gamepad2,
    GitBranch,
    KeyRound,
    LayoutDashboard,
    Network,
    Package,
    Server,
    Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogOut } from "lucide-react";

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
    { href: "/headscale", label: "Network", icon: Network },
];

const adminNav: NavItem[] = [
    { href: "/admin/orders", label: "Order Queue", icon: ClipboardList },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/minecraft", label: "Whitelist", icon: Server },
    { href: "/admin/server", label: "Server", icon: Gamepad2 },
    { href: "/admin/headscale", label: "Network", icon: Network },
    { href: "/admin/github", label: "GitHub", icon: GitBranch },
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

export function Sidebar({
    isAdmin,
    name,
    email,
}: {
    isAdmin: boolean;
    name: string;
    email: string;
}) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        pathname === href || (!EXACT.has(href) && pathname.startsWith(`${href}/`));

    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSignOut() {
        setLoading(true);
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/login");
                    router.refresh();
                },
                onError: () => setLoading(false),
            },
        });
    }

    return (
        <aside className="border-sidebar-border bg-sidebar hidden w-60 shrink-0 flex-col border-r md:flex">
            <div className="border-sidebar-border flex h-16 items-center border-b px-5">
                <Image
                    src="/logo.png"
                    alt="TrickFire Robotics"
                    width={160}
                    height={40}
                    className="object-contain"
                    priority
                />
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
            <div className="border-sidebar-border flex items-center gap-3 border-t px-4 py-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={name}>
                        {name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs" title={email}>
                        {email}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSignOut}
                    disabled={loading}
                    className="h-9 w-9 shrink-0"
                >
                    <LogOut className="size-4" />
                </Button>
            </div>
        </aside>
    );
}
