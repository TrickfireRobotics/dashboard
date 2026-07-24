type JobStatus = "pending" | "running" | "done" | "error";

interface Job {
    status: JobStatus;
    archivePath?: string;
    sizeBytes?: number;
    error?: string;
    createdAt: number;
}

const jobs = new Map<string, Job>();
const JOB_TTL_MS = 60 * 60 * 1000;

function purgeExpired() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of jobs) {
        if (job.createdAt < cutoff) jobs.delete(id);
    }
}

export function createJob(): string {
    purgeExpired();
    const id = crypto.randomUUID();
    jobs.set(id, { status: "pending", createdAt: Date.now() });
    return id;
}

export function getJob(id: string): Job | undefined {
    return jobs.get(id);
}

export function startJob(
    id: string,
    fn: () => Promise<{ archivePath: string; sizeBytes: number }>
) {
    const job = jobs.get(id);
    if (!job) return;
    job.status = "running";
    fn().then(
        ({ archivePath, sizeBytes }) => {
            job.status = "done";
            job.archivePath = archivePath;
            job.sizeBytes = sizeBytes;
        },
        (err) => {
            job.status = "error";
            job.error = err instanceof Error ? err.message : String(err);
        }
    );
}
