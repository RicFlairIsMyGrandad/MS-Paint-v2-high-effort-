const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  nativeImage,
  protocol,
} = require("electron");
const fs = require("node:fs/promises");
const syncFS = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { assetHandler } = require("./resources.cjs");
// The editor and AI are CPU-compatible. Prefer the stable software renderer on
// Windows laptops where GPU/driver failures can leave an otherwise loaded window white.
if (process.platform === "win32" && !process.argv.includes("--enable-hardware-acceleration")) app.disableHardwareAcceleration();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "paintplus",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
let win,
  settings = { preferences: {}, outputFolder: null },
  dirty = false,
  closing = false;
const profileArg = process.argv.find((a) => a.startsWith("--user-data-dir="));
if (profileArg)
  app.setPath("userData", profileArg.slice("--user-data-dir=".length));
const logPath = () => path.join(app.getPath("userData"), "startup.log");
function log(event, detail = {}) {
  try {
    syncFS.mkdirSync(app.getPath("userData"), { recursive: true });
    const file = logPath();
    if (syncFS.existsSync(file) && syncFS.statSync(file).size > 1024 * 1024) syncFS.renameSync(file, file + ".previous");
    syncFS.appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), event, ...detail }) + "\n");
  } catch {}
}
log("process-start", { version: app.getVersion(), platform: process.platform, electron: process.versions.electron });
const testResultsArg = process.argv.find(a => a.startsWith("--test-results="));
const testResultsPath = testResultsArg ? testResultsArg.slice("--test-results=".length) : "/tmp/paintplus-desktop-results.json";
let rendererReady = false, startupWatchdog;
function startupFailure(error) {
  log("startup-failed", { message: error.message, stack: error.stack });
  dialog.showErrorBox("PaintPlus could not start", error.message + "\n\nStartup log: " + logPath());
  app.exit(1);
}
process.on("uncaughtException", startupFailure);
const allowedWrites = new Set();
const extensions = new Set([".png", ".jpg", ".jpeg", ".bmp", ".webp", ".gif"]);
const configPath = () => path.join(app.getPath("userData"), "settings.json");
const saveSettings = async () => {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  const temp = configPath() + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, JSON.stringify(settings), "utf8");
    await fs.rename(temp, configPath());
  } catch (e) {
    await fs.unlink(temp).catch(() => {});
    throw e;
  }
};
const okString = (s) => typeof s === "string" && s.length < 32768;
async function readImage(file) {
  if (!okString(file) || !extensions.has(path.extname(file).toLowerCase()))
    throw new Error("Unsupported image file.");
  const stat = await fs.stat(file);
  if (stat.size > 128 * 1024 * 1024)
    throw new Error("Image files must be smaller than 128 MB.");
  const data = await fs.readFile(file);
  const ext = path.extname(file).slice(1).toLowerCase();
  return {
    path: file,
    name: path.basename(file, path.extname(file)),
    url:
      "data:image/" +
      (ext === "jpg" ? "jpeg" : ext) +
      ";base64," +
      data.toString("base64"),
  };
}
function setupIPC() {
  ipcMain.on("startup:ready", () => {
    rendererReady = true;
    clearTimeout(startupWatchdog);
    log("renderer-ready");
  });
  ipcMain.on("startup:error", (_, detail) => {
    log("renderer-error", { message: String(detail?.message || detail).slice(0, 8192), stack: String(detail?.stack || "").slice(0, 16384) });
  });
  ipcMain.handle("startup:log-path", () => logPath());
  ipcMain.on("document:close-after-save", (_, saved) => {
    if (saved) {
      closing = true;
      win.close();
    }
  });
  ipcMain.handle("settings:get", () => settings);
  ipcMain.handle("settings:set", async (_, patch) => {
    for (const key of ["preferences", "library", "categories"])
      if (patch[key] !== undefined) settings[key] = patch[key];
    await saveSettings();
    return true;
  });
  ipcMain.handle("window:action", async (_, action) => {
    if (action === "minimize") win.minimize();
    if (action === "maximize")
      win.isMaximized() ? win.unmaximize() : win.maximize();
    if (action === "close") win.close();
  });
  ipcMain.on("document:dirty", (_, value) => {
    dirty = !!value;
  });
  ipcMain.handle("dialog:open", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        {
          name: "Images & PaintPlus projects",
          extensions: ["paintplus", "png", "jpg", "jpeg", "bmp", "webp", "gif"],
        },
      ],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0];
    allowedWrites.add(file);
    if (path.extname(file).toLowerCase() === ".paintplus") {
      const stat = await fs.stat(file);
      if (stat.size > 500 * 1024 * 1024)
        throw new Error("Project file is too large.");
      return { project: await fs.readFile(file, "utf8"), path: file };
    }
    return readImage(file);
  });
  ipcMain.handle("dialog:assets", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: [...extensions].map((x) => x.slice(1)) },
      ],
    });
    if (r.canceled) return [];
    return Promise.all(r.filePaths.map(readImage));
  });
  ipcMain.handle("dialog:folder", async (_, kind) => {
    const r = await dialog.showOpenDialog(win, {
      title:
        kind === "output" ? "Choose Quick Save folder" : "Add asset folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled) return null;
    const folder = r.filePaths[0];
    if (kind === "output") {
      settings.outputFolder = folder;
      await saveSettings();
      return { path: folder };
    }
    const images = [];
    async function scan(dir, depth = 0) {
      if (depth > 12 || images.length >= 5000) return;
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await scan(full, depth + 1);
        else if (
          e.isFile() &&
          extensions.has(path.extname(e.name).toLowerCase())
        )
          images.push({
            path: full,
            name: path.basename(e.name, path.extname(e.name)),
          });
        if (images.length >= 5000) break;
      }
    }
    await scan(folder);
    return {
      path: folder,
      name: path.basename(folder),
      images,
      truncated: images.length >= 5000,
    };
  });
  ipcMain.handle("image:read", (_, file) => readImage(file));
  ipcMain.handle("image:thumbnail", async (_, file) => {
    const image = await readImage(file),
      source = nativeImage.createFromDataURL(image.url);
    if (source.isEmpty()) throw new Error("Cannot preview this image.");
    const size = source.getSize();
    return source
      .resize(
        size.width >= size.height
          ? { width: 160, quality: "good" }
          : { height: 160, quality: "good" },
      )
      .toDataURL();
  });
  ipcMain.handle("export:save", async (_, req) => {
    if (
      !["png", "jpg", "jpeg", "bmp", "webp", "paintplus"].includes(req.format)
    )
      throw new Error("Unsupported output format.");
    if (
      typeof req.name !== "string" ||
      !req.name.trim() ||
      /[<>:"/\\|?*\x00-\x1f]/.test(req.name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(req.name) ||
      /[. ]$/.test(req.name)
    )
      throw new Error("Choose a valid Windows filename.");
    let file;
    if (req.quick) {
      if (!settings.outputFolder)
        throw new Error("Choose an output folder first.");
      const base = path.join(
        settings.outputFolder,
        req.name + "." + req.format,
      );
      file = base;
      let i = 2;
      for (;;) {
        try {
          await fs.access(file);
          file = path.join(
            settings.outputFolder,
            req.name + " (" + i++ + ")." + req.format,
          );
        } catch {
          break;
        }
      }
    } else if (
      req.path &&
      allowedWrites.has(req.path) &&
      (path.extname(req.path).toLowerCase() === "." + req.format || req.format==='jpg'&&path.extname(req.path).toLowerCase()==='.jpeg')
    ) {
      file = req.path;
    } else {
      const r = await dialog.showSaveDialog(win, {
        defaultPath: req.name + "." + req.format,
        filters: [
          {
            name:
              req.format === "paintplus"
                ? "PaintPlus project"
                : req.format.toUpperCase() + " image",
            extensions: [req.format],
          },
        ],
      });
      if (r.canceled) return null;
      file = r.filePath;
      allowedWrites.add(file);
    }
    const bytes = Buffer.from(req.bytes);
    if (bytes.length > 500 * 1024 * 1024)
      throw new Error("Export is too large.");
    if (req.quick) await fs.writeFile(file, bytes, { flag: "wx" });
    else {
      const temp = file + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(temp, bytes, { flag: "wx" });
        await fs.rename(temp, file);
      } catch (e) {
        await fs.unlink(temp).catch(() => {});
        throw e;
      }
    }
    return { path: file, name: path.basename(file) };
  });
  ipcMain.handle("clipboard:write", (_, data) => {
    const image = nativeImage.createFromDataURL(data);
    if (image.isEmpty()) throw new Error("Cannot copy this image.");
    clipboard.writeImage(image);
    return true;
  });
  ipcMain.handle("clipboard:read", () => {
    const image = clipboard.readImage();
    return image.isEmpty() ? null : image.toDataURL();
  });
}
app.whenReady().then(async () => {
  try {
    settings = {
      ...settings,
      ...JSON.parse(await fs.readFile(configPath(), "utf8")),
    };
  } catch {
    delete settings.library;
    delete settings.categories;
  }
  if (process.argv.includes("--desktop-test")) {
    settings.outputFolder = "/tmp/paintplus-native-smoke";
    await fs.mkdir(settings.outputFolder, { recursive: true });
  }
  const dist = path.resolve(__dirname, "../dist");
  log("resources", { dist, packaged: app.isPackaged });
  protocol.handle("paintplus", assetHandler(dist, log));
  setupIPC();
  win = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    backgroundColor: "#f5f6f7",
    title: "PaintPlus",
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon.png")
      : path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("preload-error", (_, preload, error) => log("preload-error", { message: error.message }));
  win.webContents.on("did-fail-load", (_, code, description, url, mainFrame) => {
    log("load-failed", { code, description, url, mainFrame });
    if (mainFrame && code !== -3) startupFailure(new Error(description));
  });
  win.webContents.on("render-process-gone", (_, detail) => startupFailure(new Error("The editor process stopped: " + detail.reason)));
  win.webContents.on("will-navigate", (event, url) => {
    if (
      !url.startsWith("paintplus://app/") &&
      !(dev && url.startsWith("http://localhost:5173/"))
    )
      event.preventDefault();
  });
  win.on("close", (event) => {
    if (dirty && !closing) {
      event.preventDefault();
      dialog
        .showMessageBox(win, {
          type: "question",
          message: "Save your changes before closing?",
          detail:
            "Save a PaintPlus project to keep layers, text and editable images.",
          buttons: ["Save project", "Discard", "Cancel"],
          defaultId: 0,
          cancelId: 2,
        })
        .then((r) => {
          if (r.response === 1) {
            closing = true;
            win.close();
          }
          if (r.response === 0)
            win.webContents.send("document:save-before-close");
        });
    }
  });
  const dev = process.argv.includes("--dev");
  await win.loadURL(
    dev ? "http://localhost:5173/" : "paintplus://app/index.html",
  );
  if (!rendererReady) startupWatchdog = setTimeout(() => log("startup-timeout", { message: "Renderer did not become ready within 25 seconds." }), 25000);
  if (process.argv.includes("--desktop-test")) {
    setTimeout(async () => {
      try {
        const results = await win.webContents.executeJavaScript(
          "window.paintplus.desktopSmoke()",
        );
        await fs.writeFile(
          testResultsPath,
          JSON.stringify(results, null, 2),
        );
        closing = true;
        app.quit();
      } catch (e) {
        await fs.writeFile(
          testResultsPath,
          JSON.stringify({ error: e.message }),
        );
        app.exit(1);
      }
    }, 2000);
  }
  const projectArg = process.argv.find((s) => /\.paintplus$/i.test(s));
  if (projectArg) {
    try {
      win.webContents.send(
        "project:open",
        await fs.readFile(projectArg, "utf8"),
      );
    } catch (e) {
      dialog.showErrorBox("Cannot open project", e.message);
    }
  }
}).catch(startupFailure);
app.on("window-all-closed", () => app.quit());
