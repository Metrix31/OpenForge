
import archiver from "archiver";
import extractZip from "extract-zip";
import * as yauzl from "yauzl";
import * as tar from "tar";

import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export type ArchiveFormat = "zip" | "tar" | "tar.gz";

export interface ArchiveProgress {
    processed: number;
    total: number;
    percent: number;
}

export interface ArchiveEntry {
    path: string;
    directory: boolean;
}

function getFormat(filePath: string): ArchiveFormat {
    const name = filePath.toLowerCase();

    if (name.endsWith(".zip")) return "zip";
    if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
        return "tar.gz";
    }
    if (name.endsWith(".tar")) return "tar";

    throw new Error("Unsupported archive format.");
}

function isInside(parent: string, candidate: string): boolean {
    const relative = path.relative(parent, candidate);

    return (
        relative === "" ||
        (!path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`))
    );
}

export async function createArchive(
    source: string,
    destination: string,
    format: ArchiveFormat,
    onProgress: (progress: ArchiveProgress) => void
): Promise<void> {
    if (!["zip", "tar", "tar.gz"].includes(format)) {
        throw new Error("Unsupported archive format.");
    }

    const sourcePath = path.resolve(source);
    const destinationPath = path.resolve(destination);

    const stats = await fs.promises.stat(sourcePath);

    if (!stats.isDirectory()) {
        throw new Error("The source must be a directory.");
    }

    if (isInside(sourcePath, destinationPath)) {
        throw new Error(
            "The archive cannot be saved inside its source folder."
        );
    }

    if (sourcePath === destinationPath) {
        throw new Error("The source and destination must be different.");
    }

    await fs.promises.mkdir(path.dirname(destinationPath), {
        recursive: true
    });

    const archive =
        format === "zip"
            ? archiver("zip", { zlib: { level: 6 } })
            : archiver("tar", {
                gzip: format === "tar.gz",
                gzipOptions: { level: 6 }
            });

    const output = fs.createWriteStream(destinationPath, {
        flags: "w"
    });

    archive.on("progress", (data) => {
        const total = data.entries.total;
        const processed = data.entries.processed;

        onProgress({
            processed,
            total,
            percent: total > 0
                ? Math.round((processed / total) * 100)
                : 0
        });
    });

    const completion = pipeline(archive, output);

    try {
        archive.directory(sourcePath, false);
        await archive.finalize();
        await completion;
    } catch (error) {
        archive.abort();
        output.destroy();

        await fs.promises.rm(destinationPath, {
            force: true
        }).catch(() => undefined);

        throw error;
    }
}

export async function listArchive(
    archivePath: string
): Promise<ArchiveEntry[]> {
    const resolved = path.resolve(archivePath);
    const stats = await fs.promises.stat(resolved);

    if (!stats.isFile()) {
        throw new Error("The archive must be a file.");
    }

    const format = getFormat(resolved);

    if (format === "zip") {
        return new Promise((resolve, reject) => {
            yauzl.open(
                resolved,
                {
                    lazyEntries: true,
                    autoClose: false
                },
                (error, zipFile) => {
                    if (error || !zipFile) {
                        reject(error ?? new Error("Could not open ZIP archive."));
                        return;
                    }

                    const entries: ArchiveEntry[] = [];
                    let settled = false;

                    const fail = (cause: Error) => {
                        if (settled) return;
                        settled = true;
                        zipFile.close();
                        reject(cause);
                    };

                    zipFile.on("error", fail);

                    zipFile.on("entry", (entry) => {
                        if (settled) return;

                        const entryPath = entry.fileName;
                        const directory = entryPath.endsWith("/");

                        entries.push({
                            path: entryPath,
                            directory
                        });

                        zipFile.readEntry();
                    });

                    zipFile.on("end", () => {
                        if (settled) return;
                        settled = true;
                        zipFile.close();
                        resolve(entries);
                    });

                    zipFile.readEntry();
                }
            );
        });
    }

    const entries: ArchiveEntry[] = [];

    await tar.t({
        file: resolved,
        onentry(entry) {
            entries.push({
                path: entry.path,
                directory: entry.type === "Directory"
            });
        }
    });

    return entries;
}

export async function extractArchive(
    archivePath: string,
    destination: string
): Promise<void> {
    const resolvedArchive = path.resolve(archivePath);
    const resolvedDestination = path.resolve(destination);

    const archiveStats = await fs.promises.stat(resolvedArchive);

    if (!archiveStats.isFile()) {
        throw new Error("The archive must be a file.");
    }

    const format = getFormat(resolvedArchive);

    await fs.promises.mkdir(resolvedDestination, {
        recursive: true
    });

    if (format === "zip") {
        await extractZip(resolvedArchive, {
            dir: resolvedDestination
        });
        return;
    }

    await tar.x({
        file: resolvedArchive,
        cwd: resolvedDestination,
        strict: true
    });
}
