import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { auth } from "@/lib/auth/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.isActive === false) {
        redirect("/login");
    }
    if (!session.user.approved) {
        redirect("/pending");
    }

    Sentry.setUser({ id: session.user.id, email: session.user.email });

    return (
        <div className="flex h-full overflow-hidden">
            <Sidebar name={session.user.name} email={session.user.email} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <TopNav name={session.user.name} email={session.user.email} />
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
}
