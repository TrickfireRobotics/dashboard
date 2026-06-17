"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { NavContent } from "./SidebarNav";
import type { FeatureKey } from "@/lib/features";

export function Sidebar({
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
                <Link href="/dashboard" className="transition-opacity hover:opacity-80">
                    <Image
                        src="/logo.png"
                        alt="TrickFire Robotics"
                        width={160}
                        height={40}
                        className="cursor-pointer object-contain"
                        priority
                    />
                </Link>
            </div>
            <NavContent
                isAdmin={isAdmin}
                canAccessVault={canAccessVault}
                grantedFeatures={grantedFeatures}
            />
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
