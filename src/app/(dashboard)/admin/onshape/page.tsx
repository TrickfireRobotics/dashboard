import { Boxes } from "lucide-react";

import { AdminOnshapeManager } from "@/components/onshape/AdminOnshapeManager";
import { EmptyState } from "@/components/ui/empty-state";
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
                <EmptyState
                    icon={Boxes}
                    title="Onshape is not configured"
                    description={
                        <>
                            Set <span className="font-mono">ONSHAPE_ACCESS_KEY</span> and{" "}
                            <span className="font-mono">ONSHAPE_SECRET_KEY</span> to enable
                            management.
                        </>
                    }
                />
            ) : !company ? (
                <EmptyState
                    icon={Boxes}
                    title="Couldn't reach the Onshape company"
                    description={
                        <>
                            Verify the API key has access to a Professional/Enterprise company and
                            that <span className="font-mono">ONSHAPE_COMPANY_ID</span> (if set) is
                            correct.
                        </>
                    }
                />
            ) : (
                <AdminOnshapeManager company={company} />
            )}
        </div>
    );
}
