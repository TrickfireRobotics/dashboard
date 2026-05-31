import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function ApiKeysPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl">API Keys</h1>
                    <p className="text-muted-foreground">
                        A secret manager for the clubs API keys. Not yet implemented.
                    </p>
                </div>
            </div>
        </div>
    );
}
