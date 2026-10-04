const { Plugin, TFile } = require("obsidian");

const PAGE = 15; // rows per Page Up / Page Down

// Explorer Arrows — keyboard navigation for Obsidian's file explorer, plus
// zoom and pan for image and video files.
//
// The explorer owns the arrow keys from the moment you click in it until you
// click anywhere else (the note, another pane). Obsidian moves focus into the
// editor whenever a file opens, so the plugin takes keyboard focus back and
// opens notes with { active: false }, which leaves focus where it is.
module.exports = class ExplorerArrows extends Plugin {
  onload() {
    this.active = false;
    this.current = null; // path of the highlighted explorer item

    this.registerDomEvent(document, "mousedown", (e) => {
      const pane = e.target.closest && e.target.closest('.workspace-leaf-content[data-type="file-explorer"]');
      this.active = !!pane;
      if (!pane) this.mark(null);
    }, true);

    // rows re-render as the explorer scrolls: keep the cursor on its file
    this.registerEvent(this.app.workspace.on("layout-change", () => this.paint()));
    this.registerDomEvent(document, "scroll", (e) => {
      if (this.current && e.target.classList && e.target.classList.contains("nav-files-container")) this.paint();
    }, true);

    this.registerDomEvent(document, "click", (e) => {
      if (!this.active) return;
      const title = e.target.closest(".nav-file-title, .nav-folder-title");
      if (!title) return;
      this.mark(title);
      setTimeout(() => this.focusExplorer(), 0); // after Obsidian's own focus move
    }, true);

    this.setupMediaZoom();

    this.registerDomEvent(document, "keydown", (e) => {
      if (!this.active || e.altKey || e.shiftKey) return;
      // only while focus is really in the explorer: a hotkey that moved focus
      // elsewhere without a click (Cmd+N, the command palette) gets its keys
      const c = this.container();
      const focus = document.activeElement;
      if (!c || (focus && focus !== document.body && !c.contains(focus))) return;
      // Ctrl+Up/Down = top/bottom. Ctrl and Cmd both count (a remapped
      // keyboard may send either), but only on Up/Down: every other Ctrl/Cmd
      // chord stays Obsidian's.
      const jump = (e.metaKey || e.ctrlKey) && (e.key === "ArrowUp" || e.key === "ArrowDown");
      if ((e.metaKey || e.ctrlKey) && !jump) return;
      const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter",
                    "PageUp", "PageDown", "Home", "End"];
      if (!keys.includes(e.key)) return;
      if (e.target.closest && e.target.closest("input, textarea, .prompt, .modal")) return;
      e.preventDefault();
      e.stopPropagation();
      this.handle(jump ? (e.key === "ArrowUp" ? "Home" : "End") : e.key);
    }, true);
  }

  onunload() {
    this.mark(null);
    document.querySelectorAll(".explorer-arrows-media").forEach((m) => {
      m.style.transform = "";
      m.classList.remove("explorer-arrows-media", "is-panning");
    });
  }

  // --- image / video zoom ---------------------------------------------------
  // Ctrl+scroll (or Cmd+scroll, or a trackpad pinch, which Chromium reports
  // as Ctrl+wheel) over an image or video file zooms THAT media around the
  // pointer, and dragging pans it — the window and the explorer stay as they
  // are. Only a CSS transform changes, so Obsidian's fit-to-pane layout is
  // untouched. State lives on the media element itself, so opening another
  // file starts it fresh; double-click resets.
  setupMediaZoom() {
    const MEDIA = '.workspace-leaf-content[data-type="image"] img, ' +
                  '.workspace-leaf-content[data-type="video"] video';
    const mediaAt = (target) => {
      const leaf = target.closest && target.closest(
        '.workspace-leaf-content[data-type="image"], .workspace-leaf-content[data-type="video"]');
      return leaf ? leaf.querySelector("img, video") : null;
    };
    const state = (m) => m._eaZoom || (m._eaZoom = { s: 1, x: 0, y: 0 });
    const apply = (m) => {
      const z = state(m);
      m.classList.add("explorer-arrows-media");
      m.style.transformOrigin = "0 0";
      m.style.transform = `translate(${z.x}px, ${z.y}px) scale(${z.s})`;
    };

    this.registerDomEvent(document, "wheel", (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const m = mediaAt(e.target);
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      const z = state(m);
      // smooth for trackpads, ~20% per notch for a wheel
      const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.06 : 0.002));
      const s2 = Math.min(20, Math.max(0.1, z.s * k));
      // keep the point under the cursor fixed: the untransformed box is the
      // current one with the transform undone
      const r = m.getBoundingClientRect();
      const ox = r.left - z.x, oy = r.top - z.y;
      const px = e.clientX - ox, py = e.clientY - oy;
      z.x = px - (px - z.x) * (s2 / z.s);
      z.y = py - (py - z.y) * (s2 / z.s);
      z.s = s2;
      apply(m);
    }, { capture: true, passive: false });

    let pan = null;
    this.registerDomEvent(document, "mousedown", (e) => {
      if (e.button !== 0) return;
      const m = e.target.closest && e.target.closest(MEDIA);
      if (!m) return;
      const z = state(m);
      if (m.tagName === "VIDEO") {
        // leave a video's own controls alone: pan only when zoomed, and
        // never from the control strip along the bottom
        const r = m.getBoundingClientRect();
        if (z.s === 1 || e.clientY > r.bottom - 48) return;
      }
      e.preventDefault(); // no native image drag-and-drop
      pan = { m, x: e.clientX - z.x, y: e.clientY - z.y, sx: e.clientX, sy: e.clientY, moved: false };
      m.classList.add("is-panning");
    }, true);
    this.registerDomEvent(document, "mousemove", (e) => {
      if (!pan) return;
      if (Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 3) pan.moved = true;
      const z = state(pan.m);
      z.x = e.clientX - pan.x;
      z.y = e.clientY - pan.y;
      apply(pan.m);
    }, true);
    this.registerDomEvent(document, "mouseup", () => {
      if (!pan) return;
      pan.m.classList.remove("is-panning");
      if (pan.moved) {
        // a drag is not a click: swallow the click that follows it
        const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => document.removeEventListener("click", stop, true), 0);
      }
      pan = null;
    }, true);
    this.registerDomEvent(document, "dblclick", (e) => {
      const m = e.target.closest && e.target.closest(MEDIA);
      if (!m || !m._eaZoom) return;
      e.preventDefault();
      e.stopPropagation();
      m._eaZoom = { s: 1, x: 0, y: 0 };
      apply(m);
    }, true);
  }

  container() {
    return document.querySelector('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container');
  }

  items() {
    const c = this.container();
    if (!c) return [];
    // visible rows only: a collapsed folder's children have no layout box
    return [...c.querySelectorAll(".nav-file-title, .nav-folder-title")]
      .filter((el) => el.offsetParent !== null);
  }

  currentEl(items) {
    return items.find((el) => el.dataset.path === this.current)
      || items.find((el) => el.classList.contains("is-active"));
  }

  handle(key) {
    const items = this.items();
    if (!items.length) return;
    const cur = this.currentEl(items);
    const isFolder = cur && cur.classList.contains("nav-folder-title");
    const collapsed = cur && cur.parentElement.classList.contains("is-collapsed");

    if (key === "ArrowDown" || key === "ArrowUp") {
      let i = cur ? items.indexOf(cur) : -1;
      i = key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      this.select(items[i]);
    } else if (key === "PageUp" || key === "PageDown") {
      let i = cur ? items.indexOf(cur) : 0;
      i = key === "PageDown" ? Math.min(items.length - 1, i + PAGE) : Math.max(0, i - PAGE);
      this.select(items[i]);
    } else if (key === "Home" || key === "End") {
      this.select(key === "Home" ? items[0] : items[items.length - 1]);
    } else if (key === "ArrowRight" || key === "Enter") {
      if (isFolder && collapsed) cur.click();          // unfold
      else if (isFolder) this.select(this.items()[items.indexOf(cur) + 1]);
      else if (cur && (key === "Enter" || this.editable(cur))) this.openInEditor(cur);
      // Right on an image, PDF or other non-text file: nothing
    } else if (key === "ArrowLeft") {
      if (isFolder && !collapsed) cur.click();         // fold
      else if (cur) {                                  // jump to the parent folder
        const parent = cur.parentElement.parentElement.closest(".nav-folder");
        const title = parent && parent.querySelector(":scope > .nav-folder-title");
        if (title && title.offsetParent !== null) this.select(title);
      }
    }
    this.focusExplorer();
  }

  // a file the editor can type into: whatever Obsidian opens in its markdown
  // view (.md, plus .txt and friends when a plugin registers them)
  editable(el) {
    const file = this.app.vault.getAbstractFileByPath(el.dataset.path);
    if (!(file instanceof TFile)) return false;
    const reg = this.app.viewRegistry;
    const type = reg && reg.getTypeByExtension ? reg.getTypeByExtension(file.extension) : null;
    return type === "markdown" || ["md", "txt"].includes(file.extension);
  }

  select(el) {
    if (!el) return;
    this.mark(el);
    el.scrollIntoView({ block: "nearest" });
    const file = this.app.vault.getAbstractFileByPath(el.dataset.path);
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (file instanceof TFile && leaf) leaf.openFile(file, { active: false });
  }

  // Right or Enter on a note: open it and give the editor the keys, like a click on the note
  openInEditor(el) {
    const file = this.app.vault.getAbstractFileByPath(el.dataset.path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) return;
    leaf.openFile(file, { active: true });
    this.active = false;
    this.mark(null);
  }

  // ONE cursor. Obsidian draws its own focus ring (has-focus) on the row it
  // last focused whenever the explorer has focus, so the plugin moves that
  // ring instead of drawing a second one beside it. The explorer recycles
  // row elements as it scrolls, so after every move the ring is re-applied
  // by path, never left on an element that may now show another file.
  mark(el) {
    this.current = el ? el.dataset.path : null;
    this.paint();
    requestAnimationFrame(() => this.paint()); // after the scroll re-render
  }

  paint() {
    const c = this.container();
    if (!c) return;
    c.querySelectorAll(".has-focus, .explorer-arrows-cursor").forEach((n) => {
      if (n.dataset.path !== this.current) n.classList.remove("has-focus", "explorer-arrows-cursor");
    });
    if (!this.current) return;
    const row = [...c.querySelectorAll(".nav-file-title, .nav-folder-title")]
      .find((n) => n.dataset.path === this.current);
    if (row) row.classList.add("has-focus", "explorer-arrows-cursor");
  }

  focusExplorer() {
    const c = this.container();
    if (!c || !this.active) return;
    if (!c.hasAttribute("tabindex")) c.setAttribute("tabindex", "-1");
    if (document.activeElement && document.activeElement !== c) document.activeElement.blur();
    c.focus({ preventScroll: true });
  }
};
