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

    return (
        <div className="flex min-h-screen">
            <Sidebar isAdmin={isAdmin} />
            <div className="flex min-w-0 flex-1 flex-col">
                <TopNav
                    name={session.user.name}
                    email={session.user.email}
                    role={session.user.role ?? "member"}
                />
                <main className="flex-1 p-6">{children}</main>
            </div>
        </div>
    );
}
