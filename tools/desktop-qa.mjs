import { _electron as electron } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const application = await electron.launch({
  executablePath: "node_modules/electron/dist/electron",
  args: [
    "--no-sandbox",
    "--disable-gpu",
    ".",
    "--user-data-dir=/tmp/paintplus-desktop-qa",
  ],
  env: {
    ...process.env,
    DISPLAY: ":99",
    XDG_CACHE_HOME: "/workspace/.cache",
    XDG_CONFIG_HOME: "/tmp/paintplus-desktop-qa-config",
  },
});
const page = await application.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.waitForFunction(() => window.paintplus);
await page.evaluate(() => paintplus.demo());
await page
  .locator(".asset-card img")
  .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
await page.waitForTimeout(200);
mkdirSync("docs/screenshots", { recursive: true });
await page.screenshot({ path: "docs/screenshots/paintplus-desktop.png" });
await page.evaluate(() => paintplus.resizeDialog());
await page.waitForTimeout(200);
await page.screenshot({ path: "docs/screenshots/paintplus-final.png" });
await page.getByRole("button", { name: "Cancel", exact: true }).click();
const png = await page.evaluate(async () => [
  ...(await paintplus.exportBytes("png")),
]);
writeFileSync("docs/screenshots/example-export.png", Buffer.from(png));
const project = await page.evaluate(async () => [
  ...(await paintplus.exportBytes("paintplus")),
]);
writeFileSync("docs/Example.paintplus", Buffer.from(project));
console.log(
  JSON.stringify({
    protocol: await page.evaluate(() => location.protocol),
    errors,
    screenshot: "docs/screenshots/paintplus-final.png",
    projectBytes: project.length,
    pngBytes: png.length,
  }),
);
await application.evaluate(({ app }) => app.exit(0));
