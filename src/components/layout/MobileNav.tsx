"use client";

import { LogOut, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth/client";
import { NavContent } from "./SidebarNav";
import type { FeatureKey } from "@/lib/features";

export function MobileNav({
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
    const [open, setOpen] = useState(false);
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
        <div className="md:hidden">
            <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
            >
                <Menu className="size-5" />
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    side="left"
                    className="bg-sidebar border-sidebar-border flex w-60 flex-col p-0"
                >
                    <SheetHeader className="border-sidebar-border border-b px-5">
                        <SheetTitle className="sr-only">Navigation</SheetTitle>
                        <div className="flex h-16 items-center">
                            <Link
                                href="/dashboard"
                                onClick={() => setOpen(false)}
                                className="transition-opacity hover:opacity-80"
                            >
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
                    </SheetHeader>

                    <NavContent
                        isAdmin={isAdmin}
                        canAccessVault={canAccessVault}
                        grantedFeatures={grantedFeatures}
                        onLinkClick={() => setOpen(false)}
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
                </SheetContent>
            </Sheet>
        </div>
    );
}
