import { AdminOnshapeManager } from "@/components/onshape/AdminOnshapeManager";
import { getOnshapeCompany, isOnshapeConfigured } from "@/lib/integrations/onshape";

export default async function AdminOnshapePage() {
    const configured = isOnshapeConfigured();
    const company = configured ? await getOnshapeCompany() : null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Onshape</h1>
                <p className="text-muted-foreground">
                    Manage Onshape company members, teams, and access.
                </p>
            </div>

            {!configured ? (
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    Onshape is not configured. Set{" "}
                    <span className="font-mono">ONSHAPE_ACCESS_KEY</span> and{" "}
                    <span className="font-mono">ONSHAPE_SECRET_KEY</span> to enable management.
                </div>
            ) : !company ? (
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    Couldn&apos;t reach the Onshape company. Verify the API key has access to a
                    Professional/Enterprise company and that{" "}
                    <span className="font-mono">ONSHAPE_COMPANY_ID</span> (if set) is correct.
                </div>
            ) : (
                <AdminOnshapeManager company={company} />
            )}
        </div>
    );
}
