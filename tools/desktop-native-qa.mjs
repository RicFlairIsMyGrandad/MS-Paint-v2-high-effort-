import { _electron as electron } from "@playwright/test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const directory = "/tmp/paintplus-native-extra";
await mkdir(directory, { recursive: true });
const application = await electron.launch({
  executablePath: "node_modules/electron/dist/electron",
  args: ["--no-sandbox", "--disable-gpu", ".", "--user-data-dir=/tmp/paintplus-native-extra-profile"],
  env: { ...process.env, DISPLAY: ":99", XDG_CACHE_HOME: "/workspace/.cache" },
});
const page = await application.firstWindow();
const electronProcess = application.process();
await page.waitForFunction(() => window.paintplus);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await application.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ["/workspace/MS-Paint-v2-high-effort-/assets/demo"] });
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: "/tmp/paintplus-native-extra/image.jpg" });
  });
  const folder = await page.evaluate(() => desktop.chooseFolder("assets"));
  assert(folder.images.length >= 3);
  assert(folder.images.every(image => image.path && !image.url));
  const thumbnail = await page.evaluate(async () => {
    const url = await desktop.thumbnail("/workspace/MS-Paint-v2-high-effort-/assets/demo/hero.png");
    const image = new Image(); image.src = url; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.equal(Math.max(thumbnail.width, thumbnail.height), 160);
  const bytes = await page.evaluate(async () => [...await paintplus.exportBytes("jpg")]);
  await page.evaluate(bytes => desktop.save({ name: "image", format: "jpg", bytes }), bytes);
  const first = await readFile(directory + "/image.jpg");
  assert.equal(first[0], 255); assert.equal(first[1], 216);
  await page.evaluate(bytes => desktop.save({ name: "image", format: "jpg", bytes, path: "/tmp/paintplus-native-extra/image.jpg" }), bytes);
  assert.deepEqual(await readFile(directory + "/image.jpg"), first);
  assert(!(await readdir(directory)).some(name => name.endsWith(".tmp")));
  await page.evaluate(() => paintplus.doc.addLayer("Close test"));
  await application.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0 });
    dialog.showSaveDialog = async () => ({ canceled: true });
  });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.waitForTimeout(400);
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  assert.equal(await page.evaluate(() => paintplus.doc.dirty), true);
  await application.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: "/tmp/paintplus-native-extra/close-save.paintplus" });
  });
  const closed = application.waitForEvent("close");
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed;
  const project = JSON.parse(await readFile(directory + "/close-save.paintplus", "utf8"));
  assert.equal(project.version, 1);
  assert(project.layers.some(layer => layer.name === "Close test"));
  assert.deepEqual(errors, []);
  const result = { nativeFolderMetadata: true, nativeThumbnail160px: true, atomicSaveAndOverwrite: true, canceledSaveKeepsWindowAndDirtyDocument: true, successfulSaveWritesProjectBeforeClose: true, rendererErrors: errors };
  await writeFile("docs/desktop-extra-test-results.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (electronProcess.exitCode === null) await application.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
