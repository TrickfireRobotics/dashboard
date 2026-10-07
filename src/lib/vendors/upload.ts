// Request handling shared by the vendor-import preview and apply routes.

import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import {
    hashFile,
    parseVendorWorkbook,
    VendorImportError,
    type VendorRecord,
} from "@/lib/vendors/import";

// The real export is ~6MB; leave headroom without accepting anything huge.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// /api/* isn't covered by middleware.ts, so check approval here too: this
// route rewrites shared data, unlike the read-only routes that only check for
// a session.
export async function requireApprovedUser(): Promise<SessionUser | NextResponse> {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.approved || user.isActive === false) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return user;
}

export type VendorUpload = {
    form: FormData;
    fileName: string;
    fileHash: string;
    records: VendorRecord[];
};

/** Reads and parses the multipart `file` field. Never written to disk. */
export async function readVendorUpload(req: NextRequest): Promise<VendorUpload | NextResponse> {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return NextResponse.json({ error: "Upload the .xlsx supplier export" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "File is larger than 20MB" }, { status: 413 });
    }

    const data = new Uint8Array(await file.arrayBuffer());
    try {
        return {
            form,
            fileName: file.name,
            fileHash: hashFile(data),
            records: parseVendorWorkbook(data),
        };
    } catch (err) {
        if (err instanceof VendorImportError) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
    }
}
