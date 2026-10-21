import { NextResponse } from "next/server";

import { getImportHistory } from "@/lib/vendors/import";
import { requireApprovedUser } from "@/lib/vendors/upload";

// Every past import, newest first, for the Finance-page history dialog.
export async function GET() {
    const user = await requireApprovedUser();
    if (user instanceof NextResponse) return user;

    return NextResponse.json({ imports: getImportHistory() });
}
