import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.isActive === false) {
        redirect("/login");
    }

    const isAdmin = session.user.role === "admin";
    const canAccessVault = isAdmin || session.user.canAccessVault === true;

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar
                isAdmin={isAdmin}
                canAccessVault={canAccessVault}
                name={session.user.name}
                email={session.user.email}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <TopNav />
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
}
