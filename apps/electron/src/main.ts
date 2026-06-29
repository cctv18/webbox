import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";

let serverProcess: ReturnType<typeof spawn> | undefined;

async function createWindow() {
  const root = path.resolve(app.getAppPath(), "..", "..");
  const serverEntry = path.join(root, "packages", "server", "dist", "index.js");
  const port = process.env.WEBBOX_PORT || "8787";
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: { ...process.env, WEBBOX_PORT: port },
    stdio: "inherit"
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Webbox",
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  await win.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => serverProcess?.kill());
