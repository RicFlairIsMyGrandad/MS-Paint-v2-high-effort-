import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1680, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE:", m.text());
});
await page.goto("http://localhost:5173");
await page.waitForFunction(() => window.paintplus);
await page
  .locator(".asset-card img")
  .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
await page.screenshot({ path: "docs/screenshots/blank.png" });
await page.evaluate(() => window.paintplus.demo());
await page.waitForTimeout(200);
await page.screenshot({ path: "docs/screenshots/demo.png" });
console.log(
  await page.evaluate(() => ({
    layers: paintplus.doc.layers.map((l) => ({
      name: l.name,
      objects: l.objects.map((o) => ({
        name: o.name,
        width: o.width,
        height: o.height,
        x: o.x,
        y: o.y,
      })),
    })),
    zoom: paintplus.zoom,
    assets: paintplus.library.assets.length,
  })),
);
await page.evaluate(() => paintplus.resizeDialog());
await page.waitForTimeout(200);
await page.screenshot({ path: "docs/screenshots/paintplus-final.png" });
await browser.close();
