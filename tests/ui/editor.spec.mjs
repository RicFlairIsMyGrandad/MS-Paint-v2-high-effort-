import { test, expect } from "@playwright/test";
async function reset(page, w = 300, h = 200) {
  await page.goto("/");
  await page.waitForFunction(() => window.paintplus);
  await page.evaluate(
    async ({ w, h }) => {
      const { PaintDocument } = await import("/src/core/document.js");
      paintplus.doc = new PaintDocument(w, h, () => paintplus.changedUI());
      paintplus.zoom = 1;
      paintplus.prefs.aspectLock = false;
      paintplus.changedUI();
    },
    { w, h },
  );
  await page.waitForTimeout(100);
}
async function drag(page, a, b, button = "left") {
  const r = await page.locator("#overlay").boundingBox(),
    z = await page.evaluate(() => paintplus.zoom);
  await page.mouse.move(r.x + a.x * z, r.y + a.y * z);
  await page.mouse.down({ button });
  await page.mouse.move(r.x + b.x * z, r.y + b.y * z, { steps: 12 });
  await page.mouse.up({ button });
  await page.waitForTimeout(100);
}
const at = (page, x, y, layer = 0) =>
  page.evaluate(
    ({ x, y, layer }) => [
      ...paintplus.doc.layers[layer].canvas
        .getContext("2d")
        .getImageData(x, y, 1, 1).data,
    ],
    { x, y, layer },
  );
async function sprite(page, ownLayer = true) {
  return page.evaluate(
    ({ ownLayer }) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 80;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#1847f1";
      ctx.fillRect(5, 5, 54, 70);
      const o = paintplus.doc.insert(c, "Test sprite", ownLayer);
      paintplus.tool = "move";
      paintplus.changedUI();
      return o.id;
    },
    { ownLayer },
  );
}
test("pencil, Color 1 / Color 2, cursor and Ctrl+Numpad widths", async ({
  page,
}) => {
  await reset(page);
  await page.keyboard.press("3");
  await expect(page.locator("#overlay")).toHaveCSS("cursor", /url/);
  await drag(page, { x: 20, y: 25 }, { x: 150, y: 25 });
  expect(await at(page, 60, 25)).toEqual([24, 71, 241, 255]);
  await page.locator('[data-color="#ed1c24"]').click({ button: "right" });
  await drag(page, { x: 20, y: 45 }, { x: 150, y: 45 }, "right");
  expect(await at(page, 60, 45)).toEqual([237, 28, 36, 255]);
  await page.keyboard.press("Control+NumpadAdd");
  expect(await page.evaluate(() => paintplus.width)).toBe(5);
  await page.keyboard.press("Control+NumpadSubtract");
  expect(await page.evaluate(() => paintplus.width)).toBe(4);
});
test("brush widths and 100 strokes stay on the active raster layer with undo/redo", async ({
  page,
}) => {
  await reset(page);
  await page.locator('[data-action="new-layer"]').click();
  await page.keyboard.press("2");
  await drag(page, { x: 20, y: 30 }, { x: 150, y: 30 });
  expect(await at(page, 60, 30, 1)).toEqual([24, 71, 241, 255]);
  expect(await at(page, 60, 30)).toEqual([255, 255, 255, 255]);
  await page.evaluate(() => {
    for (let i = 0; i < 100; i++) {
      const edit = paintplus.doc.beginRaster();
      edit.capture(0, 0, 100, 100);
      paintplus.doc.activeLayer.canvas
        .getContext("2d")
        .fillRect(10 + (i % 50), 60, 1, 1);
      edit.commit("Stroke");
    }
  });
  expect(await page.evaluate(() => paintplus.doc.layers.length)).toBe(2);
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(0);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  expect(
    await page.evaluate(() => paintplus.doc.history.redoStack.length),
  ).toBe(0);
});
test("eraser on background uses Color 2, fill and eyedropper work", async ({
  page,
}) => {
  await reset(page);
  await page.keyboard.press("2");
  await drag(page, { x: 20, y: 30 }, { x: 150, y: 30 });
  await page.evaluate(() => paintplus.setTool("eraser"));
  await drag(page, { x: 60, y: 20 }, { x: 60, y: 40 });
  expect(await at(page, 60, 30)).toEqual([255, 255, 255, 255]);
  await page.keyboard.press("4");
  await drag(page, { x: 200, y: 150 }, { x: 200, y: 150 });
  expect(await at(page, 200, 150)).toEqual([24, 71, 241, 255]);
  await page.keyboard.press("7");
  await page.locator('[data-color="#ed1c24"]').click();
  await drag(page, { x: 200, y: 150 }, { x: 200, y: 150 });
  expect(await page.evaluate(() => paintplus.color1)).toBe("#1847f1");
});
test("all brush variants produce strokes, shapes honor outline and fill", async ({
  page,
}) => {
  await reset(page);
  for (const brush of [
    "round",
    "square",
    "calligraphy",
    "airbrush",
    "oil",
    "crayon",
    "marker",
    "watercolor",
  ]) {
    await page.evaluate((b) => {
      paintplus.brush = b;
      paintplus.width = 12;
      return paintplus.setTool("brush");
    }, brush);
    await drag(page, { x: 25, y: 25 }, { x: 120, y: 45 });
  }
  await page.locator("[data-shape=rectangle]").click();
  await page.locator("#shape-fill").selectOption("solid");
  await drag(page, { x: 160, y: 50 }, { x: 240, y: 110 });
  expect(await at(page, 200, 80)).toEqual([255, 255, 255, 255]);
  expect(await at(page, 160, 80)).toEqual([24, 71, 241, 255]);
});
test("canvas boundary handles resize the canvas, not pixels, and undo", async ({
  page,
}) => {
  await reset(page);
  await page.keyboard.press("3");
  await drag(page, { x: 10, y: 20 }, { x: 100, y: 20 });
  for (const [kind, dx, dy, w, h] of [
    ["right", 40, 0, 340, 200],
    ["bottom", 0, 25, 340, 225],
    ["corner", 30, 20, 370, 245],
  ]) {
    const r = await page.locator(`[data-canvas-handle=${kind}]`).boundingBox();
    await page.mouse.move(r.x + 3, r.y + 3);
    await page.mouse.down();
    await page.mouse.move(r.x + 3 + dx, r.y + 3 + dy, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(() => [paintplus.doc.width, paintplus.doc.height]),
      )
      .toEqual([w, h]);
  }
  expect(await at(page, 50, 20)).toEqual([24, 71, 241, 255]);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => paintplus.doc.width)).toBe(340);
});
test("asset insertion at exact (0,0), original dimensions at every zoom and alpha", async ({
  page,
}) => {
  await reset(page);
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 80;
    c.getContext("2d").fillRect(5, 5, 50, 60);
    await paintplus.library.addFiles([
      { name: "Small sprite", url: c.toDataURL() },
    ]);
    paintplus.editor.setZoom(0.5);
  });
  await page
    .locator(".asset-card")
    .filter({ hasText: "Small sprite" })
    .dblclick();
  expect(
    await page.evaluate(() => {
      const o = paintplus.doc.selectedObjects[0];
      return [
        o.x,
        o.y,
        o.width,
        o.height,
        o.source.getContext("2d").getImageData(0, 0, 1, 1).data[3],
      ];
    }),
  ).toEqual([0, 0, 64, 80, 0]);
  await page.evaluate(() => paintplus.editor.setZoom(2));
  expect(
    await page.evaluate(() => paintplus.doc.selectedObjects[0].width),
  ).toBe(64);
});
test("object corner and edge resizing, aspect lock, no cumulative source degradation", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  await page.evaluate(() => {
    paintplus.prefs.aspectLock = true;
  });
  await drag(page, { x: 64, y: 80 }, { x: 128, y: 160 });
  expect(
    await page.evaluate(() => {
      const o = paintplus.doc.selectedObjects[0];
      return Math.abs(o.width / o.height - 0.8) < 0.0001;
    }),
  ).toBe(true);
  await page.evaluate(() => {
    paintplus.prefs.aspectLock = false;
  });
  const w = await page.evaluate(() => paintplus.doc.selectedObjects[0].width);
  await drag(page, { x: w, y: 80 }, { x: w + 30, y: 80 });
  expect(
    await page.evaluate(() => paintplus.doc.selectedObjects[0].width),
  ).toBeCloseTo(w + 30, 0);
  await page.evaluate(() => {
    const o = paintplus.doc.selectedObjects[0];
    for (let i = 0; i < 20; i++) {
      o.width = 5;
      o.height = 6;
      o.width = 64;
      o.height = 80;
    }
  });
  expect(
    await page.evaluate(() => {
      const o = paintplus.doc.selectedObjects[0];
      return [o.source.width, o.source.height];
    }),
  ).toEqual([64, 80]);
});
test("free rotation handle, numerical rotation, flips and undo", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  await page.evaluate(() => {
    const o = paintplus.doc.selectedObjects[0];
    o.x = 60;
    o.y = 60;
    paintplus.changedUI();
  });
  await drag(page, { x: 92, y: 35 }, { x: 170, y: 100 });
  expect(
    await page.evaluate(() => Math.abs(paintplus.doc.selectedObjects[0].angle)),
  ).toBeGreaterThan(60);
  await page.locator("[data-action=resize]").click();
  await page.locator("#resize-angle").fill("-15");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect(
    await page.evaluate(() => paintplus.doc.selectedObjects[0].angle),
  ).toBe(-15);
  await page.evaluate(() => paintplus.flip("H"));
  expect(
    await page.evaluate(() => paintplus.doc.selectedObjects[0].flipH),
  ).toBe(true);
  await page.keyboard.press("Control+z");
  expect(
    await page.evaluate(() => paintplus.doc.selectedObjects[0].flipH),
  ).toBe(false);
});
test("rectangular and free selections can move, Color 2 transparency works", async ({
  page,
}) => {
  await reset(page);
  await page.evaluate(() => {
    paintplus.prefs.transparentSelection = true;
    const ctx = paintplus.doc.activeLayer.canvas.getContext("2d");
    ctx.fillStyle = "#1847f1";
    ctx.fillRect(30, 30, 40, 40);
  });
  await page.keyboard.press("0");
  await drag(page, { x: 20, y: 20 }, { x: 80, y: 80 });
  expect(
    await page.evaluate(
      () => paintplus.doc.selectedObjects[0].transparentColor,
    ),
  ).toBe("#ffffff");
  await drag(page, { x: 50, y: 50 }, { x: 130, y: 50 });
  expect(await page.evaluate(() => paintplus.doc.selectedObjects[0].x)).toBe(
    100,
  );
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  expect(await at(page, 40, 40)).toEqual([24, 71, 241, 255]);
  await page.keyboard.press("1");
  await drag(page, { x: 25, y: 25 }, { x: 90, y: 90 });
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(1);
});
test("clipboard copy/paste preserves dimensions and transforms remain editable", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect
    .poll(() => page.evaluate(() => paintplus.doc.objects.length))
    .toBe(2);
  expect(
    await page.evaluate(() => {
      const o = paintplus.doc.selectedObjects[0];
      return [o.x, o.y, o.width, o.height];
    }),
  ).toEqual([0, 0, 64, 80]);
  await page.keyboard.press("Delete");
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(1);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => paintplus.doc.objects.length)).toBe(2);
});
test("layers select, hide, lock, duplicate, reorder and merge", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  await page.waitForTimeout(120);
  await page.locator(".layer-row").filter({ hasText: "Test sprite" }).click();
  await page.locator(".layer-row.active .visibility").click();
  expect(await page.evaluate(() => paintplus.doc.activeLayer.visible)).toBe(
    false,
  );
  await page.locator(".layer-row.active .visibility").click();
  await page.locator(".layer-row.active .lock-layer").click();
  expect(await page.evaluate(() => paintplus.doc.activeLayer.locked)).toBe(
    true,
  );
  await page.locator(".layer-row.active .lock-layer").click();
  await page.locator("[data-action=duplicate-layer]").click();
  expect(await page.evaluate(() => paintplus.doc.layers.length)).toBe(3);
  await page.locator("[data-action=layer-down]").click();
  expect(await page.evaluate(() => paintplus.doc.layers[1].name)).toContain(
    "copy",
  );
  await page.locator("[data-action=merge-layer]").click();
  expect(await page.evaluate(() => paintplus.doc.layers.length)).toBe(2);
});
test("multi-layer grouping transforms objects together and ungroups", async ({
  page,
}) => {
  await reset(page);
  const a = await sprite(page);
  const b = await sprite(page);
  await page.evaluate(
    ({ a, b }) => {
      paintplus.doc.selected = [a, b];
      paintplus.doc.objects[1].x = 100;
      paintplus.changedUI();
    },
    { a, b },
  );
  await page.keyboard.press("Control+g");
  expect(
    await page.evaluate(
      () => paintplus.doc.objects[0].group === paintplus.doc.objects[1].group,
    ),
  ).toBe(true);
  await drag(page, { x: 40, y: 40 }, { x: 65, y: 65 });
  expect(
    await page.evaluate(() => paintplus.doc.objects.map((o) => [o.x, o.y])),
  ).toEqual([
    [25, 25],
    [125, 25],
  ]);
  await page.keyboard.press("Control+Shift+g");
  expect(
    await page.evaluate(() => paintplus.doc.objects.every((o) => !o.group)),
  ).toBe(true);
});
test("asset removal, categories, search, favorite, list and thumbnail controls work", async ({
  page,
}) => {
  await reset(page);
  await page.locator("#asset-search").fill("Hero");
  await expect(page.locator(".asset-card")).toHaveCount(1);
  await page.locator(".asset-card").click({ button: "right" });
  await page
    .getByRole("button", { name: "Remove from library", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".asset-card")).toHaveCount(0);
  await page.locator("#asset-search").fill("");
  await page.locator("[data-action=asset-list]").click();
  await expect(page.locator("#asset-grid")).toHaveClass(/list/);
  await page.locator("[data-action=asset-settings]").click();
  await page
    .getByRole("button", { name: "New category…", exact: true })
    .click();
  await page.locator("#prompt-input").fill("My sprites");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.locator(".category.active")).toContainText("My sprites");
  await page.reload();
  await page.waitForFunction(() => window.paintplus);
  expect(
    await page.evaluate(() =>
      paintplus.library.assets.some((a) => a.id === "hero"),
    ),
  ).toBe(false);
});
test("independent panel collapse expands workspace and persists across launch", async ({
  page,
}) => {
  await reset(page);
  const before = await page.locator("#workspace").boundingBox();
  await page.locator("#assets-panel [data-action=toggle-assets]").click();
  await expect(page.locator("#assets-panel")).toBeHidden();
  await expect(page.locator("#assets-tab")).toBeVisible();
  const after = await page.locator("#workspace").boundingBox();
  expect(after.width).toBeGreaterThan(before.width + 250);
  await page.locator("#layers-panel [data-action=toggle-layers]").click();
  await expect(page.locator("#layers-tab")).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => window.paintplus);
  await expect(page.locator("#assets-tab")).toBeVisible();
  await expect(page.locator("#layers-tab")).toBeVisible();
  await page.locator("#assets-tab").click();
  await expect(page.locator("#assets-panel")).toBeVisible();
});
test("project save/reopen preserves source, groups, layers, text and exact pixels", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  const result = await page.evaluate(async () => {
    const { serialize, deserialize } = await import("/src/core/project.js");
    const o = paintplus.doc.objects[0];
    o.x = 32;
    o.y = 47;
    o.angle = -15;
    o.width = 20;
    o.height = 25;
    o.group = "test-group";
    paintplus.doc.layers[0].locked = true;
    paintplus.doc.layers[1].name = "Sprite layer";
    const text = serialize(paintplus.doc),
      d = await deserialize(text),
      r = d.objects[0];
    return {
      size: [d.width, d.height],
      layerName: d.layers[1].name,
      lock: d.layers[0].locked,
      transform: [r.x, r.y, r.width, r.height, r.angle],
      source: [r.source.width, r.source.height],
      group: r.group,
      selected: d.selected.length,
      pixel: [...r.source.getContext("2d").getImageData(10, 10, 1, 1).data],
    };
  });
  expect(result).toEqual({
    size: [300, 200],
    layerName: "Sprite layer",
    lock: true,
    transform: [32, 47, 20, 25, -15],
    source: [64, 80],
    group: "test-group",
    selected: 1,
    pixel: [24, 71, 241, 255],
  });
});
test("exports PNG/JPEG/WebP/BMP and browser Quick Save produce real images", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  const signatures = await page.evaluate(async () => {
    const result = {};
    for (const f of ["png", "jpg", "bmp", "webp"]) {
      const b = await paintplus.exportBytes(f);
      result[f] = [...b.slice(0, 12)];
    }
    return result;
  });
  expect(signatures.png.slice(0, 4)).toEqual([137, 80, 78, 71]);
  expect(signatures.jpg.slice(0, 2)).toEqual([255, 216]);
  expect(signatures.bmp.slice(0, 2)).toEqual([66, 77]);
  expect(signatures.webp.slice(8, 12)).toEqual([87, 69, 66, 80]);
  await page.locator("#filename").fill("Export Test");
  const download = page.waitForEvent("download");
  await page.locator("[data-action=quick-save]").click();
  expect((await download).suggestedFilename()).toBe("Export Test.png");
  await page.locator("#filename").fill("../bad");
  await page.locator("[data-action=quick-save]").click();
  await expect(page.locator("#toast")).toContainText("valid Windows filename");
});
test("shortcut edits preserve reserved controls and work without intercepting text fields", async ({
  page,
}) => {
  await reset(page);
  await page
    .locator(".shortcuts-panel [data-action=shortcuts]")
    .first()
    .click();
  await page.locator('[data-shortcut="0"]').selectOption("brush");
  await page.locator('[data-shortcut="2"]').selectOption("select");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.keyboard.press("0");
  expect(await page.evaluate(() => paintplus.tool)).toBe("brush");
  await page.locator("#filename").fill("");
  await page.locator("#filename").press("3");
  expect(await page.evaluate(() => paintplus.tool)).toBe("brush");
  await page.locator("#filename").blur();
  await page.keyboard.press("Control+NumpadAdd");
  expect(await page.evaluate(() => paintplus.width)).toBe(5);
});
test("zoom changes viewport scaling only, rulers and scrolling follow canvas", async ({
  page,
}) => {
  await reset(page, 1200, 800);
  await page.evaluate(() => paintplus.editor.setZoom(2));
  await expect(page.locator("#zoom-percent")).toHaveText("200%");
  expect((await page.locator("#overlay").boundingBox()).width).toBe(2400);
  expect(await page.evaluate(() => paintplus.doc.width)).toBe(1200);
  await page.evaluate(() => {
    paintplus.editor.viewport.scrollLeft = 200;
    paintplus.editor.viewport.scrollTop = 150;
  });
  expect(await page.evaluate(() => paintplus.editor.viewport.scrollLeft)).toBe(
    200,
  );
  await page.locator("[data-tab=view]").click();
  await page.locator("#show-rulers").uncheck();
  await expect(page.locator("#ruler-x")).toBeHidden();
  await page.locator("#show-rulers").check();
  await expect(page.locator("#ruler-y")).toBeVisible();
});
test("tool cursors change across drawing, text, selection, eyedropper and handles", async ({
  page,
}) => {
  await reset(page);
  const cursors = [];
  for (const tool of [
    "pencil",
    "brush",
    "eraser",
    "fill",
    "dropper",
    "text",
    "select",
    "move",
    "zoom",
  ]) {
    await page.evaluate((t) => paintplus.setTool(t), tool);
    await page.mouse.move(600, 500);
    cursors.push(
      await page.locator("#overlay").evaluate((el) => el.style.cursor),
    );
  }
  expect(new Set(cursors).size).toBe(9);
  await sprite(page);
  await page.mouse.move(340 + 64, 204 + 80);
  await expect(page.locator("[data-canvas-handle=corner]")).toHaveCSS(
    "cursor",
    "nwse-resize",
  );
});
test("text creates editable object, rasterizes from original and undoes", async ({
  page,
}) => {
  await reset(page);
  await page.keyboard.press("5");
  await drag(page, { x: 30, y: 40 }, { x: 30, y: 40 });
  await page.locator("#text-content").fill("PaintPlus\nHello!");
  await page.getByRole("button", { name: "Insert text", exact: true }).click();
  expect(await page.evaluate(() => paintplus.doc.objects[0].text)).toBe(
    "PaintPlus\nHello!",
  );
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => paintplus.doc.objects.length))
    .toBe(0);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => paintplus.doc.objects[0].text)).toBe(
    "PaintPlus\nHello!",
  );
});
test("Lanczos worker rasterizes object and preserves undoable original", async ({
  page,
}) => {
  await reset(page);
  await sprite(page);
  await page.evaluate(() => {
    const o = paintplus.doc.selectedObjects[0];
    o.width = 32;
    o.height = 40;
  });
  await page.locator("[data-action=rasterize]").click();
  await expect
    .poll(() => page.evaluate(() => paintplus.doc.objects.length))
    .toBe(0);
  expect((await at(page, 10, 10, 1))[3]).toBeGreaterThan(0);
  await page.keyboard.press("Control+z");
  expect(await page.evaluate(() => paintplus.doc.objects[0].source.width)).toBe(
    64,
  );
});
test("offline CPU AI actually removes background and keeps alpha", async ({
  page,
}) => {
  test.setTimeout(180000);
  await reset(page);
  const external = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://localhost:5173") &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.evaluate(async () => {
    const { imageCanvas } = await import("/src/core/project.js");
    const hero = await imageCanvas("/demo/hero.png"),
      c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(hero, 45, 12, 165, 230);
    paintplus.doc.insert(c, "AI test");
    paintplus.tool = "move";
    paintplus.changedUI();
  });
  await page.locator("[data-action=background-remove]").click();
  await expect
    .poll(() => page.evaluate(() => paintplus.busy), { timeout: 150000 })
    .toBe(false);
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Refine background mask",
  );
  const alpha = await page.evaluate(() => {
    const o = paintplus.doc.selectedObjects[0],
      data = o.source.getContext("2d").getImageData(0, 0, 256, 256).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 100) n++;
    return { corner: data[3], subject: n };
  });
  expect(alpha.corner).toBeLessThan(10);
  expect(alpha.subject).toBeGreaterThan(1000);
  expect(alpha.subject).toBeLessThan(60000);
  expect(external).toEqual([]);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press("Control+z");
  expect(
    await page.evaluate(
      () =>
        paintplus.doc.selectedObjects[0].source
          .getContext("2d")
          .getImageData(0, 0, 1, 1).data[3],
    ),
  ).toBe(255);
});
