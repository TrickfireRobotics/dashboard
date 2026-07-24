import { NextResponse, type NextRequest } from "next/server";

import { getJob } from "@/lib/sim/jobs";
import { streamArchive } from "@/lib/sim/stream";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
    const { jobId } = await params;
    const job = getJob(jobId);

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === "error") {
        return NextResponse.json({ error: job.error }, { status: 500 });
    }

    if (job.status === "done" && job.archivePath) {
        return streamArchive(job.archivePath);
    }

    return NextResponse.json({ status: job.status }, { status: 202 });
}
