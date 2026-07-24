import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";

export async function streamArchive(archivePath: string): Promise<Response> {
    const { size } = await stat(archivePath);
    const nodeStream = createReadStream(archivePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
        headers: {
            "Content-Type": "application/gzip",
            "Content-Length": String(size),
            "Content-Disposition": 'attachment; filename="sim-export.tar.gz"',
        },
    });
}
