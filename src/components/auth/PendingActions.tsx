"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function PendingActions() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleSignOut() {
        setLoading(true);
        await signOut({
            fetchOptions: {
                onSuccess: () => router.push("/login"),
                onError: () => setLoading(false),
            },
        });
    }

    return (
        <Button variant="outline" onClick={handleSignOut} disabled={loading} className="w-full">
            Sign out
        </Button>
    );
}
