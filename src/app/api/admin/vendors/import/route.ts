import { NextResponse, type NextRequest } from "next/server";

import { applyVendorImport, VendorImportConflictError } from "@/lib/vendors/import";
import { readVendorUpload, requireApprovedUser } from "@/lib/vendors/upload";

// Applies a previewed upload. The client sends the file again with the
// fileHash and baseImportId it got from ./preview; a different file or an
// import applied in between is refused so only the previewed diff lands.
export async function POST(req: NextRequest) {
    const user = await requireApprovedUser();
    if (user instanceof NextResponse) return user;

    const upload = await readVendorUpload(req);
    if (upload instanceof NextResponse) return upload;

    if (upload.form.get("fileHash") !== upload.fileHash) {
        return NextResponse.json(
            { error: "File doesn't match the preview. Upload it again." },
            { status: 400 }
        );
    }

    const rawBase = upload.form.get("baseImportId");
    const expectedBaseImportId = rawBase === "" || rawBase === null ? null : Number(rawBase);
    if (expectedBaseImportId !== null && !Number.isInteger(expectedBaseImportId)) {
        return NextResponse.json({ error: "Invalid baseImportId" }, { status: 400 });
    }

    try {
        const { diff, importInfo } = applyVendorImport(upload.records, {
            fileName: upload.fileName,
            fileHash: upload.fileHash,
            importedBy: user.id,
            expectedBaseImportId,
        });
        return NextResponse.json({
            latest: importInfo,
            added: diff.added.length,
            removed: diff.removed.length,
            changed: diff.changed.length,
        });
    } catch (err) {
        if (err instanceof VendorImportConflictError) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
    }
}
