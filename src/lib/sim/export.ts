import { execFile } from "child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const SIM_CACHE_DIR = process.env.SIM_CACHE_DIR ?? "/var/cache/trickfire-sim";

export async function runOnshapeExport(
    docId: string,
    wsId: string,
    elId: string,
    apiUrl: string
): Promise<{ archivePath: string; sizeBytes: number }> {
    await mkdir(SIM_CACHE_DIR, { recursive: true });

    const workDir = await mkdtemp(path.join(tmpdir(), "sim-export-"));
    const robotDir = path.join(workDir, "robot");
    await mkdir(robotDir);

    try {
        await writeFile(
            path.join(robotDir, "config.json"),
            JSON.stringify(
                {
                    documentId: docId,
                    workspaceId: wsId,
                    elementId: elId,
                    output_format: "urdf",
                    add_dummy_base_link: true,
                },
                null,
                2
            )
        );

        await execFileAsync("onshape-to-robot", ["."], {
            cwd: robotDir,
            env: {
                ...process.env,
                ONSHAPE_API: apiUrl,
            },
            timeout: 5 * 60 * 1000,
        });

        const archiveName = `${docId}_${wsId}_${elId}.tar.gz`;
        const archivePath = path.join(SIM_CACHE_DIR, archiveName);

        await execFileAsync("tar", ["-czf", archivePath, "-C", robotDir, "."]);

        const { size } = await stat(archivePath);
        return { archivePath, sizeBytes: size };
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
}
