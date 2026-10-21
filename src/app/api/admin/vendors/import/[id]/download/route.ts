import { NextResponse, type NextRequest } from "next/server";

import { getImportFile } from "@/lib/vendors/import";
import { requireApprovedUser } from "@/lib/vendors/upload";

// Re-downloads the exact file archived by a past import.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await requireApprovedUser();
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const importId = Number(id);
    if (!Number.isInteger(importId)) {
        return NextResponse.json({ error: "Invalid import id" }, { status: 400 });
    }

    const file = getImportFile(importId);
    if (!file) {
        return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    // Quoted-string form escapes the few characters that'd break it; the RFC
    // 5987 fallback covers filenames with non-ASCII characters.
    const safeName = file.fileName.replace(/["\\]/g, "_");
    return new NextResponse(new Blob([Uint8Array.from(file.fileData)]), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Length": String(file.fileData.length),
            "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        },
    });
}
