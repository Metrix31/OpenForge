
import {
    contextBridge,
    ipcRenderer
} from "electron";

export interface ArchiveEntry {
    path: string;
    directory: boolean;
}

export interface ArchiveProgress {
    processed: number;
    total: number;
    percent: number;
}

contextBridge.exposeInMainWorld("packForge", {
    selectFolder: () =>
        ipcRenderer.invoke("dialog:select-folder"),

    saveArchive: (format: string) =>
        ipcRenderer.invoke("dialog:save-archive", format),

    openArchive: () =>
        ipcRenderer.invoke("dialog:open-archive"),

    selectExtractFolder: () =>
        ipcRenderer.invoke("dialog:select-extract-folder"),

    listArchive: (archivePath: string): Promise<ArchiveEntry[]> =>
        ipcRenderer.invoke("archive:list", archivePath),

    extractArchive: (archivePath: string, destination: string) =>
        ipcRenderer.invoke("archive:extract", archivePath, destination),

    createArchive: (
        source: string,
        destination: string,
        format: string
    ) => ipcRenderer.invoke(
        "archive:create",
        source,
        destination,
        format
    ),

    onProgress: (callback: (progress: ArchiveProgress) => void) => {
        const listener = (
            _event: Electron.IpcRendererEvent,
            progress: ArchiveProgress
        ) => callback(progress);

        ipcRenderer.on("archive:create-progress", listener);

        return () => {
            ipcRenderer.removeListener(
                "archive:create-progress",
                listener
            );
        };
    }
});
