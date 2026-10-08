const { app, BrowserWindow, Menu } = require("electron");

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        autoHideMenuBar: true,
        frame: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    Menu.setApplicationMenu(null);

    win.loadFile("index.html");
}

app.whenReady().then(createWindow);
