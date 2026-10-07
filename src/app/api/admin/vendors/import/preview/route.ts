import { NextResponse, type NextRequest } from "next/server";

import { diffVendors, getCurrentVendors, getLatestImport } from "@/lib/vendors/import";
import { readVendorUpload, requireApprovedUser } from "@/lib/vendors/upload";

// Diffs an uploaded export against the stored list without changing anything.
// The client shows the diff, then re-sends the same file to ../route.ts with
// fileHash + baseImportId to apply exactly what was previewed.
export async function POST(req: NextRequest) {
    const user = await requireApprovedUser();
    if (user instanceof NextResponse) return user;

    const upload = await readVendorUpload(req);
    if (upload instanceof NextResponse) return upload;

    return NextResponse.json({
        fileName: upload.fileName,
        fileHash: upload.fileHash,
        baseImportId: getLatestImport()?.id ?? null,
        totalCount: upload.records.length,
        diff: diffVendors(getCurrentVendors(), upload.records),
    });
}
