import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { auth } from "@/lib/auth/auth";

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ deactivated?: string }>;
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user && session.user.isActive !== false) {
        redirect(session.user.approved ? "/dashboard" : "/pending");
    }

    const { deactivated } = await searchParams;
    const notice = deactivated ? "Your account has been deactivated. Contact an admin." : undefined;

    return (
        <div className="auth-background bg-background flex min-h-screen items-center justify-center p-4">
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
                <LoginForm notice={notice} />
            </div>
        </div>
    );
}
