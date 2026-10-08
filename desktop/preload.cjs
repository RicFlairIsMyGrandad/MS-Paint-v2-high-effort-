const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  windowAction: (action) => ipcRenderer.invoke("window:action", action),
  setDirty: (value) => ipcRenderer.send("document:dirty", value),
  open: () => ipcRenderer.invoke("dialog:open"),
  chooseAssets: () => ipcRenderer.invoke("dialog:assets"),
  chooseFolder: (kind) => ipcRenderer.invoke("dialog:folder", kind),
  readImage: (file) => ipcRenderer.invoke("image:read", file),
  thumbnail: (file) => ipcRenderer.invoke("image:thumbnail", file),
  save: (req) => ipcRenderer.invoke("export:save", req),
  copyImage: (data) => ipcRenderer.invoke("clipboard:write", data),
  pasteImage: () => ipcRenderer.invoke("clipboard:read"),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onProject: (fn) => ipcRenderer.on("project:open", (_, data) => fn(data)),
  onSaveBeforeClose: (fn) => ipcRenderer.on("document:save-before-close", fn),
  closeAfterSave: (saved) =>
    ipcRenderer.send("document:close-after-save", saved),
});
