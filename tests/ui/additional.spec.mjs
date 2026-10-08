import { test, expect } from "@playwright/test";
async function open(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.paintplus);
  await page.evaluate(async () => {
    const { PaintDocument } = await import("/src/core/document.js");
    paintplus.doc = new PaintDocument(320, 240, () => paintplus.changedUI());
    paintplus.zoom = 1;
    paintplus.changedUI();
  });
  await page.waitForTimeout(60);
}
async function stroke(page, a, b) {
  const r = await page.locator("#overlay").boundingBox();
  await page.mouse.move(r.x + a[0], r.y + a[1]);
  await page.mouse.down();
  await page.mouse.move(r.x + b[0], r.y + b[1], { steps: 6 });
  await page.mouse.up();
}
test("curve supports two bend drags and one undoable commit", async ({
  page,
}) => {
  await open(page);
  await page.locator("[data-shape=curve]").click();
  await stroke(page, [20, 100], [240, 100]);
  expect(await page.evaluate(() => paintplus.editor.pendingShape.name)).toBe(
    "curve",
  );
  await stroke(page, [70, 100], [70, 25]);
  await stroke(page, [190, 100], [190, 175]);
  expect(await page.evaluate(() => !!paintplus.editor.pendingShape)).toBe(
    false,
  );
  expect(
    await page.evaluate(() => paintplus.doc.history.undoStack.at(-1).label),
  ).toBe("Draw curve");
  const changed = await page.evaluate(() => {
    const data = paintplus.doc.activeLayer.canvas
      .getContext("2d")
      .getImageData(0, 0, 320, 240).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] !== 255) count++;
    return count;
  });
  expect(changed).toBeGreaterThan(400);
  await page.keyboard.press("Control+z");
  expect(
    await page.evaluate(
      () =>
        paintplus.doc.activeLayer.canvas
          .getContext("2d")
          .getImageData(50, 75, 1, 1).data[0],
    ),
  ).toBe(255);
});
test("polygon click corners and Enter produces a filled shape", async ({
  page,
}) => {
  await open(page);
  await page.locator("[data-shape=polygon]").click();
  await page.locator("#shape-fill").selectOption("solid");
  await page.evaluate(() => (paintplus.color2 = "#ff7f27"));
  await stroke(page, [30, 30], [180, 30]);
  const r = await page.locator("#overlay").boundingBox();
  await page.mouse.click(r.x + 120, r.y + 160);
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(() => [
      ...paintplus.doc.activeLayer.canvas
        .getContext("2d")
        .getImageData(110, 75, 1, 1).data,
    ]),
  ).toEqual([255, 127, 39, 255]);
  expect(await page.evaluate(() => paintplus.doc.layers.length)).toBe(1);
});
test("100 actual pointer strokes never create visible layers", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press("2");
  const r = await page.locator("#overlay").boundingBox();
  for (let i = 0; i < 100; i++) {
    const y = 20 + i * 2;
    await page.mouse.move(r.x + 20, r.y + y);
    await page.mouse.down();
    await page.mouse.move(r.x + 140, r.y + y);
    await page.mouse.up();
  }
  expect(
    await page.evaluate(() => ({
      layers: paintplus.doc.layers.length,
      objects: paintplus.doc.objects.length,
      undo: paintplus.doc.history.undoStack.length,
    })),
  ).toEqual({ layers: 1, objects: 0, undo: 80 });
});
test("free-form selection has a real polygon mask and leaves outside pixels", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    paintplus.doc.addLayer("Ink");
    const ctx = paintplus.doc.activeLayer.canvas.getContext("2d");
    ctx.fillStyle = "#1847f1";
    ctx.fillRect(0, 0, 320, 240);
  });
  await page.keyboard.press("1");
  const r = await page.locator("#overlay").boundingBox();
  await page.mouse.move(r.x + 20, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 120, r.y + 20, { steps: 5 });
  await page.mouse.move(r.x + 20, r.y + 120, { steps: 5 });
  await page.mouse.move(r.x + 20, r.y + 20, { steps: 5 });
  await page.mouse.up();
  expect(
    await page.evaluate(() => {
      const o = paintplus.doc.selectedObjects[0];
      return [
        o.source.getContext("2d").getImageData(10, 10, 1, 1).data[3],
        o.source.getContext("2d").getImageData(90, 90, 1, 1).data[3],
        paintplus.doc.activeLayer.canvas
          .getContext("2d")
          .getImageData(110, 110, 1, 1).data[3],
      ];
    }),
  ).toEqual([255, 0, 255]);
});
test("percentage resize, invalid dimensions, Cancel and nearest neighbour work", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 80;
    paintplus.doc.insert(c, "Sprite");
    paintplus.tool = "move";
    paintplus.changedUI();
  });
  await page.locator("[data-action=resize]").click();
  await page.locator("#resize-units").selectOption("percent");
  await page.locator("#resize-width").fill("50");
  await page.locator("#resize-quality").selectOption("nearest");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const o = paintplus.doc.objects[0];
      return [o.width, o.height, o.resampling];
    }),
  ).toEqual([32, 40, "nearest"]);
  await page.locator("[data-action=resize]").click();
  await page.locator("#resize-width").fill("99999");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("valid dimensions");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => paintplus.doc.objects[0].width)).toBe(32);
});
test("selection options switch Color 2 transparency and preserve true alpha", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 40;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 40, 40);
    ctx.fillStyle = "#1847f1";
    ctx.fillRect(10, 10, 20, 20);
    paintplus.doc.insert(c, "Sprite");
    paintplus.tool = "move";
    paintplus.changedUI();
  });
  await page.locator("[data-action=select-menu]").click();
  await page
    .getByRole("button", {
      name: "Transparent selection (Color 2)",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(() => paintplus.doc.objects[0].transparentColor),
  ).toBe("#ffffff");
  const png = await page.evaluate(async () => {
    const bytes = await paintplus.exportBytes("png"),
      blob = new Blob([bytes], { type: "image/png" }),
      image = await createImageBitmap(blob),
      c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    c.getContext("2d").drawImage(image, 0, 0);
    return [...c.getContext("2d").getImageData(15, 15, 1, 1).data];
  });
  expect(png).toEqual([24, 71, 241, 255]);
});
test("AI on a raster layer replaces alpha rather than covering the old background", async ({
  page,
}) => {
  test.setTimeout(120000);
  await open(page);
  await page.evaluate(async () => {
    const { imageCanvas } = await import("/src/core/project.js"),
      hero = await imageCanvas("/demo/hero.png"),
      ctx = paintplus.doc.activeLayer.canvas.getContext("2d");
    ctx.drawImage(hero, 70, 10, 160, 220);
    paintplus.doc.selected = [];
  });
  await page.locator("[data-action=background-remove]").click();
  await expect
    .poll(() => page.evaluate(() => paintplus.busy), { timeout: 100000 })
    .toBe(false);
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Refine background mask",
  );
  expect(
    await page.evaluate(
      () =>
        paintplus.doc.activeLayer.canvas
          .getContext("2d")
          .getImageData(0, 0, 1, 1).data[3],
    ),
  ).toBeLessThan(10);
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press("Control+z");
  expect(
    await page.evaluate(
      () =>
        paintplus.doc.activeLayer.canvas
          .getContext("2d")
          .getImageData(0, 0, 1, 1).data[3],
    ),
  ).toBe(255);
});
test("bundled thumbnails decode and palette ends in exact signature blue", async ({
  page,
}) => {
  await open(page);
  const images = await page.locator(".asset-card img").evaluateAll((imgs) =>
    Promise.all(
      imgs.map(async (i) => {
        await i.decode();
        return i.naturalWidth;
      }),
    ),
  );
  expect(images).toHaveLength(10);
  expect(images.every((w) => w > 0)).toBe(true);
  await expect(page.locator(".color-chip").last()).toHaveAttribute(
    "data-color",
    "#1847F1",
  );
});

test("drawing commits an opaque deselected asset onto its existing layer", async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 120; c.height = 120;
    c.getContext("2d").fillStyle = "#ff9900";
    c.getContext("2d").fillRect(0, 0, 120, 120);
    paintplus.doc.insert(c, "Opaque asset", false);
    paintplus.doc.selected = [];
    paintplus.color1 = "#1847f1";
    await paintplus.setTool("pencil");
  });
  await stroke(page, [20, 40], [90, 40]);
  expect(await page.evaluate(() => paintplus.doc.layers.length)).toBe(1);
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(0);
  expect(await page.evaluate(() => [...paintplus.doc.activeLayer.canvas.getContext("2d").getImageData(40, 40, 1, 1).data])).toEqual([24, 71, 241, 255]);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => [...paintplus.doc.activeLayer.canvas.getContext("2d").getImageData(40, 40, 1, 1).data])).toEqual([255, 153, 0, 255]);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(1);
});
