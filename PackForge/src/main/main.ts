
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain
} from "electron";

import path from "node:path";

import {
    createArchive,
    extractArchive,
    listArchive,
    type ArchiveFormat
} from "./archive-service";

let mainWindow: BrowserWindow | null = null;
let archiveRunning = false;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 760,
        minHeight: 600,
        title: "PackForge",
        backgroundColor: "#111318",
        webPreferences: {
            preload: path.join(__dirname, "../preload/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    if (!app.isPackaged) {
        void mainWindow.loadURL(
            process.env.VITE_DEV_SERVER_URL ??
            "http://127.0.0.1:5173"
        );
    } else {
        void mainWindow.loadFile(
            path.join(__dirname, "../../dist/index.html")
        );
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

function assertValidFormat(value: unknown): asserts value is ArchiveFormat {
    if (
        value !== "zip" &&
        value !== "tar" &&
        value !== "tar.gz"
    ) {
        throw new Error("Unsupported archive format.");
    }
}

ipcMain.handle("dialog:select-folder", async () => {
    const result = await dialog.showOpenDialog({
        title: "Select source folder",
        properties: ["openDirectory"]
    });

    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:save-archive", async (_event, format: unknown) => {
    assertValidFormat(format);

    const result = await dialog.showSaveDialog({
        title: "Save archive",
        defaultPath: `archive.${format}`,
        filters: [{
            name: `${format.toUpperCase()} archive`,
            extensions: [format === "tar.gz" ? "gz" : format]
        }]
    });

    return result.canceled ? null : result.filePath;
});

ipcMain.handle("dialog:open-archive", async () => {
    const result = await dialog.showOpenDialog({
        title: "Open archive",
        properties: ["openFile"],
        filters: [{
            name: "Supported archives",
            extensions: ["zip", "tar", "gz", "tgz"]
        }]
    });

    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:select-extract-folder", async () => {
    const result = await dialog.showOpenDialog({
        title: "Select extraction destination",
        properties: ["openDirectory", "createDirectory"]
    });

    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("archive:list", async (_event, archivePath: unknown) => {
    if (typeof archivePath !== "string" || !path.isAbsolute(archivePath)) {
        throw new Error("Invalid archive path.");
    }

    return listArchive(archivePath);
});

ipcMain.handle(
    "archive:create",
    async (event, source: unknown, destination: unknown, format: unknown) => {
        if (archiveRunning) {
            throw new Error("Another archive operation is already running.");
        }

        if (
            typeof source !== "string" ||
            typeof destination !== "string" ||
            !path.isAbsolute(source) ||
            !path.isAbsolute(destination)
        ) {
            throw new Error("Invalid source or destination path.");
        }

        assertValidFormat(format);
        archiveRunning = true;

        try {
            await createArchive(source, destination, format, (progress) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send("archive:create-progress", progress);
                }
            });

            return { success: true };
        } finally {
            archiveRunning = false;
        }
    }
);

ipcMain.handle(
    "archive:extract",
    async (_event, archivePath: unknown, destination: unknown) => {
        if (archiveRunning) {
            throw new Error("Another archive operation is already running.");
        }

        if (
            typeof archivePath !== "string" ||
            typeof destination !== "string" ||
            !path.isAbsolute(archivePath) ||
            !path.isAbsolute(destination)
        ) {
            throw new Error("Invalid archive or destination path.");
        }

        archiveRunning = true;

        try {
            await extractArchive(archivePath, destination);
            return { success: true };
        } finally {
            archiveRunning = false;
        }
    }
);
