import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PendingActions } from "@/components/auth/PendingActions";
import { auth } from "@/lib/auth/auth";

export default async function PendingPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect("/login");
    }
    if (session.user.approved) {
        redirect("/dashboard");
    }

    return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 flex flex-col items-center gap-2">
                    <Image
                        src="/logo.png"
                        alt="TrickFire Robotics"
                        width={220}
                        height={56}
                        className="h-35 w-auto object-contain"
                        priority
                    />
                </div>
                <div className="space-y-4 text-center">
                    <h1 className="text-2xl font-semibold">Account pending approval</h1>
                    <p className="text-muted-foreground text-sm">
                        Your account has been created and your email verified. An admin needs to
                        approve your account before you can access the dashboard.
                    </p>
                    <p className="text-muted-foreground text-sm">
                        Signed in as{" "}
                        <span className="text-foreground font-medium">{session.user.email}</span>
                    </p>
                    <PendingActions />
                </div>
            </div>
        </div>
    );
}
