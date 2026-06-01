import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
            <div>
                <p className="text-primary text-sm font-medium tracking-widest uppercase">404</p>
                <h1 className="mt-2 text-3xl">Page not found</h1>
                <p className="text-muted-foreground mt-1">
                    This page doesn&apos;t exist or you don&apos;t have access to it!
                </p>
            </div>
            <Link href="/dashboard" className={buttonVariants()}>
                Go to dashboard
            </Link>
        </div>
    );
}
