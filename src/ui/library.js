import { icon } from "./icons.js";
import { imageCanvas } from "../core/project.js";
const base = new URL("./", document.baseURI);
export const builtinAssets = [
  {
    id: "hero",
    name: "Hero",
    category: "characters",
    url: new URL("demo/hero.png", base).href,
    favorite: true,
  },
  {
    id: "cat",
    name: "Cat",
    category: "characters",
    url: new URL("demo/cat.png", base).href,
    favorite: true,
  },
  ...["tree", "house", "chair", "treasure", "cloud", "grass", "rock"].map(
    (name) => ({
      id: name,
      name: name[0].toUpperCase() + name.slice(1),
      category: ["tree", "house", "chair", "treasure", "rock"].includes(name)
        ? "props"
        : "effects",
      url: new URL("demo/" + name + ".svg", base).href,
    }),
  ),
  {
    id: "landscape",
    name: "Landscape",
    category: "backgrounds",
    url: new URL("demo/landscape.png", base).href,
  },
];
const defaultCategories = [
  { id: "characters", name: "Characters" },
  { id: "props", name: "Props" },
  { id: "backgrounds", name: "Backgrounds" },
  { id: "effects", name: "Effects" },
  { id: "icons", name: "UI Icons" },
  { id: "my", name: "My Assets" },
];
export class Library {
  constructor(app, settings) {
    this.app = app;
    this.assets = Array.isArray(settings.library)
      ? settings.library.filter(a => a && typeof a.id === "string" && typeof a.name === "string")
      : builtinAssets.map((a) => ({ ...a }));
    this.categories = Array.isArray(settings.categories)
      ? settings.categories.filter(c => c && typeof c.id === "string" && typeof c.name === "string")
      : defaultCategories.map((c) => ({ ...c }));
    this.current = app.prefs.category || "all";
    this.selected = [];
    this.grid = document.querySelector("#asset-grid");
    this.cache = new Map();
    this.thumbCache = new Map();
    this.visibleCount = 80;
    this.grid.addEventListener("click", (e) => {
      if (e.target.closest("[data-load-assets]")) {
        this.visibleCount += 80;
        this.render();
        return;
      }
      const card = e.target.closest(".asset-card");
      if (!card) return;
      const asset = this.assets.find((a) => a.id === card.dataset.id);
      if (e.target.closest(".favorite-button")) {
        asset.favorite = !asset.favorite;
        this.save();
        this.render();
        return;
      }
      this.selected = e.ctrlKey
        ? this.selected.includes(asset.id)
          ? this.selected.filter((id) => id !== asset.id)
          : [...this.selected, asset.id]
        : [asset.id];
      for (const node of this.grid.querySelectorAll(".asset-card"))
        node.classList.toggle(
          "selected",
          this.selected.includes(node.dataset.id),
        );
    });
    this.grid.addEventListener("dblclick", (e) => {
      const card = e.target.closest(".asset-card");
      if (card) this.insert(card.dataset.id);
    });
    this.grid.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const card = e.target.closest(".asset-card");
      if (!card) return;
      const asset = this.assets.find((a) => a.id === card.dataset.id);
      if (!this.selected.includes(asset.id)) this.selected = [asset.id];
      this.render();
      this.app.menuAt(e.clientX, e.clientY, [
        {
          label: "Insert selected assets",
          icon: "plus",
          run: () => this.insertSelected(),
        },
        {
          label: asset.favorite ? "Remove from Favorites" : "Add to Favorites",
          icon: "star",
          run: () => {
            asset.favorite = !asset.favorite;
            this.save();
            this.render();
          },
        },
        {
          label: "Assign asset shortcut…",
          icon: "gear",
          run: () => this.assignShortcut(asset),
        },
        {
          label: "Move to category…",
          icon: "folder",
          run: () => this.moveCategory(asset),
        },
        {
          label: "Remove from library",
          icon: "trash",
          run: () => this.removeSelected(),
        },
      ]);
    });
    this.grid.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".asset-card");
      if (!card) return;
      const ids = this.selected.includes(card.dataset.id)
        ? this.selected
        : [card.dataset.id];
      e.dataTransfer.setData(
        "application/paintplus-assets",
        JSON.stringify(ids),
      );
      e.dataTransfer.effectAllowed = "copy";
    });
    document.querySelector("#categories").addEventListener("click", (e) => {
      const row = e.target.closest(".category");
      if (!row) return;
      if (e.target.closest("button")) {
        const category = this.categories.find(
          (c) => c.id === row.dataset.category,
        );
        this.categoryMenu(category, e.target.closest("button"));
        return;
      }
      this.current = row.dataset.category;
      this.app.prefs.category = this.current;
      this.app.savePrefs();
      this.render();
    });
    document.querySelector("#categories").addEventListener("contextmenu", event => {
      const row = event.target.closest(".category");
      const category = this.categories.find(c => c.id === row?.dataset.category);
      if (category) { event.preventDefault();this.categoryMenu(category, row); }
    });
    document
      .querySelector("#asset-search")
      .addEventListener("input", () => this.render());
    document.querySelector("#thumb-size").value = app.prefs.thumbSize;
    document.querySelector("#thumb-size").addEventListener("input", (e) => {
      app.prefs.thumbSize = Number(e.target.value);
      app.savePrefs();
      this.render();
    });
    this.render();
  }
  async save() {
    await this.app.persist({
      library: this.assets.map((a) => {
        const { _url, ...data } = a;
        return data;
      }),
      categories: this.categories,
    });
  }
  async url(asset) {
    if (asset.url) return asset.url;
    if (this.cache.has(asset.id)) return this.cache.get(asset.id);
    if (!window.desktop)
      throw new Error("This referenced asset needs the desktop application.");
    const image = await window.desktop.readImage(asset.path);
    if(this.cache.size>=32)this.cache.delete(this.cache.keys().next().value);
    this.cache.set(asset.id, image.url);
    return image.url;
  }
  render() {
    const cat = document.querySelector("#categories");
    cat.innerHTML = [
      { id: "all", name: "All Assets", icon: "grid" },
      { id: "favorites", name: "Favorites", icon: "star" },
      { id: "recent", name: "Recently Used", icon: "clock" },
      ...this.categories.map((c) => ({ ...c, icon: "folder" })),
    ]
      .map(
        (c) =>
          `<div class="category ${this.current === c.id ? "active" : ""}" data-category="${c.id}">${icon(c.icon)}<span class="category-name">${this.app.escape(c.name)}</span>${this.categories.some((cat) => cat.id === c.id) ? '<button title="Manage category" aria-label="Manage ' + this.app.escape(c.name) + '">' + icon("gear", 15) + "</button>" : ""}</div>`,
      )
      .join("");
    const q = document.querySelector("#asset-search").value.toLowerCase();
    let assets = this.assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) &&
        (this.current === "all" ||
          (this.current === "favorites" && a.favorite) ||
          (this.current === "recent" && a.used) ||
          a.category === this.current),
    );
    if (this.current === "recent") assets.sort((a, b) => b.used - a.used);
    const filter = this.current + "|" + q;
    if (this.filter !== filter) {
      this.filter = filter;
      this.visibleCount = 80;
      this.grid.scrollTop = 0;
    }
    const total = assets.length;
    assets = assets.slice(0, this.visibleCount);
    this.grid.style.setProperty(
      "--asset-size",
      this.app.prefs.thumbSize + "px",
    );
    this.grid.style.gridTemplateColumns = this.app.prefs.assetList
      ? "1fr"
      : `repeat(auto-fill,minmax(${this.app.prefs.thumbSize - 6}px,1fr))`;
    this.grid.classList.toggle("list", this.app.prefs.assetList);
    this.grid.innerHTML = assets.length
      ? assets
          .map(
            (a) =>
              `<div class="asset-card ${this.selected.includes(a.id) ? "selected" : ""} ${a.favorite ? "is-favorite" : ""}" draggable="true" data-id="${a.id}" tabindex="0" title="${this.app.escape(a.name)} · Double-click to insert at original size"><img alt="${this.app.escape(a.name)}"><button class="favorite-button" title="Toggle favorite" aria-label="Favorite ${this.app.escape(a.name)}">${icon("star", 17)}</button><span>${this.app.escape(a.name)}</span></div>`,
          )
          .join("")
      : '<div class="empty-assets">No assets here yet.<br>Use Add Folder or Import Images.</div>';
    if (total > assets.length)
      this.grid.insertAdjacentHTML(
        "beforeend",
        `<button data-load-assets class="load-assets">Load more · ${assets.length} of ${total}</button>`,
      );
    this.observer?.disconnect();
    const load = (a, img) => {
      const get = a.path && window.desktop ? this.thumbnail(a) : this.url(a);
      get
        .then((url) => {
          if (img.isConnected) img.src = url;
        })
        .catch(() => {
          img.title =
            "Source image is unavailable. Import it from its current folder or remove this record.";
        });
    };
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            this.observer.unobserve(e.target);
            const a = this.assets.find(
              (a) => a.id === e.target.dataset.assetId,
            );
            if (a) load(a, e.target);
          }
      },
      { root: this.grid, rootMargin: "160px" },
    );
    for (const a of assets) {
      const img = this.grid.querySelector(
        `[data-id="${CSS.escape(a.id)}"] img`,
      );
      if (a.path && window.desktop) {
        img.dataset.assetId = a.id;
        this.observer.observe(img);
      } else load(a, img);
    }
    document
      .querySelector("[data-action=asset-grid]")
      .classList.toggle("active", !this.app.prefs.assetList);
    document
      .querySelector("[data-action=asset-list]")
      .classList.toggle("active", !!this.app.prefs.assetList);
  }
  async insert(assetId) {
    try {
      const asset = this.assets.find((a) => a.id === assetId);
      if (!asset) return;
      const source = await imageCanvas(await this.url(asset));
      const obj = this.app.doc.insert(
        source,
        asset.name,
        this.app.prefs.assetOwnLayer,
        {
          assetId: asset.id,
          assetPath: asset.path || null,
          smoothPreview: this.app.prefs.smoothPreview,
        },
      );
      asset.used = Date.now();
      this.app.setTool("move");
      await this.save();
      this.app.changedUI();
      return obj;
    } catch (e) {
      this.app.toast(e.message);
    }
  }
  thumbnail(asset) {
    if (!this.thumbCache.has(asset.id))
      this.thumbCache.set(
        asset.id,
        window.desktop.thumbnail(asset.path).catch(() => this.url(asset)),
      );
    return this.thumbCache.get(asset.id);
  }
  async insertSelected() {
    for (const id of this.selected) await this.insert(id);
  }
  async addFiles(images) {
    const category = ["all", "recent", "favorites"].includes(this.current)
      ? "my"
      : this.current;
    for (const image of images) {
      if (this.assets.some((a) => image.path && a.path === image.path))
        continue;
      this.assets.push({
        id: crypto.randomUUID(),
        name: image.name,
        category,
        path: image.path || undefined,
        url: image.path ? undefined : image.url,
      });
      if (image.path)
        this.cache.set(this.assets[this.assets.length - 1].id, image.url);
    }
    this.current = category;
    await this.save();
    this.render();
    this.app.toast(
      images.length +
        " image" +
        (images.length === 1 ? "" : "s") +
        " added to the library.",
    );
  }
  async addFolder() {
    if (!window.desktop) {
      document
        .querySelector("#asset-input")
        .setAttribute("webkitdirectory", "");
      document.querySelector("#asset-input").click();
      return;
    }
    try {
      const folder = await window.desktop.chooseFolder("assets");
      if (!folder) return;
      const category = {
        id: crypto.randomUUID(),
        name: folder.name,
        path: folder.path,
      };
      this.categories.push(category);
      for (const image of folder.images)
        if (!this.assets.some((a) => a.path === image.path))
          this.assets.push({
            id: crypto.randomUUID(),
            ...image,
            category: category.id,
          });
      this.current = category.id;
      await this.save();
      this.render();
      this.app.toast(
        folder.images.length +
          " images indexed" +
          (folder.truncated ? " (limited to 5,000)" : "") +
          ". Original files stay in their folder.",
      );
    } catch (e) {
      this.app.toast(e.message);
    }
  }
  async createCategory() {
    const name = await this.app.prompt(
      "New category",
      "Category name",
      "New Folder",
    );
    if (!name) return;
    const c = { id: crypto.randomUUID(), name };
    this.categories.push(c);
    this.current = c.id;
    await this.save();
    this.render();
  }
  categoryMenu(category, anchor) {
    this.app.menu(anchor, [
      {
        label: "Rename category…",
        icon: "pencil",
        run: async () => {
          const name = await this.app.prompt(
            "Rename category",
            "Name",
            category.name,
          );
          if (name) {
            category.name = name;
            await this.save();
            this.render();
          }
        },
      },
      {
        label: "Remove category from library",
        icon: "trash",
        run: async () => {
          if (
            !(await this.app.confirm(
              "Remove category?",
              `Remove “${category.name}” and its indexed assets from PaintPlus? Original files will remain on disk.`,
            ))
          )
            return;
          this.categories = this.categories.filter((c) => c.id !== category.id);
          this.assets = this.assets.filter((a) => a.category !== category.id);
          this.current = "all";
          this.app.prefs.category = 'all';
          await this.app.savePrefs();
          await this.save();
          this.render();
        },
      },
    ]);
  }
  async removeSelected() {
    if (!this.selected.length) return;
    if (
      !(await this.app.confirm(
        "Remove from library?",
        `Remove ${this.selected.length} asset(s) from the PaintPlus library? Their original files will remain on disk, and objects already in your project will be preserved.`,
      ))
    )
      return;
    this.assets = this.assets.filter((a) => !this.selected.includes(a.id));
    this.selected = [];
    await this.save();
    this.render();
  }
  async assignShortcut(asset) {
    const key = await this.app.prompt(
      "Asset shortcut",
      "Press Alt with this letter or number",
      asset.shortcut || "",
    );
    if (key === null) return;
    if (key && !/^[a-z0-9]$/i.test(key)) {
      this.app.toast("Use a single letter or number.");
      return;
    }
    const other = this.assets.find(
      (a) =>
        a.id !== asset.id &&
        a.shortcut?.toLowerCase() === key.toLowerCase() &&
        key,
    );
    if (
      other &&
      !(await this.app.confirm(
        "Shortcut conflict",
        `Alt+${key.toUpperCase()} is assigned to ${other.name}. Replace it?`,
      ))
    )
      return;
    if (other) delete other.shortcut;
    asset.shortcut = key.toLowerCase();
    await this.save();
    this.app.toast(
      key ? "Assigned Alt+" + key.toUpperCase() : "Shortcut removed.",
    );
  }
  async moveCategory(asset) {
    const html = `<label class="form-row">Category <select id="move-category">${this.categories.map((c) => `<option value="${c.id}" ${c.id === asset.category ? "selected" : ""}>${this.app.escape(c.name)}</option>`).join("")}</select></label>`;
    this.app.dialog("Move asset", html, [
      { label: "Cancel", run: () => this.app.closeDialog() },
      {
        label: "Move",
        primary: true,
        run: async () => {
          asset.category = document.querySelector("#move-category").value;
          this.app.closeDialog();
          await this.save();
          this.render();
        },
      },
    ]);
  }
}
