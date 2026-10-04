# Explorer Arrows

An [Obsidian](https://obsidian.md) plugin that makes the file explorer keyboard-driven and lets you zoom into images and videos.

- **Click a file in the explorer and the arrow keys stay there.** Obsidian normally moves keyboard focus into the note as soon as a file opens, so pressing ↓ moves the text cursor instead of the selection. With this plugin, the arrows walk the file list and each file opens in the main pane as you go, like a preview, until you click into the note.
- **Ctrl+scroll zooms an image or video file** around the pointer, without zooming the rest of Obsidian. Drag to pan; double-click to reset.

Desktop only. Tested on Obsidian 1.13 (macOS).

## Keys

After clicking in the file explorer:

| Key | Action |
|---|---|
| ↑ / ↓ | Previous / next row; files open in the main pane while focus stays in the explorer |
| Page Up / Page Down | Move 15 rows |
| Ctrl+↑ / Ctrl+↓ (or Cmd) | Jump to the top / bottom of the list |
| Home / End | Top / bottom of the list |
| → | On a collapsed folder: unfold it. On an open folder: step into it. On an editable note (`.md`, or anything Obsidian opens in its Markdown view): move focus into the note. On images, PDFs and other files: nothing |
| ← | On an open folder: fold it. Otherwise: jump to the parent folder |
| Enter | Open the selected file and move focus into it (any file type) |

Clicking inside a note, or anywhere outside the explorer, hands the arrow keys back to the editor. So does any hotkey that moves focus elsewhere, such as Cmd/Ctrl+N or the command palette.

The current row gets a single accent-coloured outline. The plugin moves Obsidian's own focus ring rather than drawing a second one.

## Image and video zoom

In an image or video file opened in its own tab (not an image embedded in a note):

| Input | Action |
|---|---|
| Ctrl+scroll (or Cmd+scroll, or trackpad pinch) | Zoom in / out around the pointer (0.1× to 20×) |
| Drag | Pan |
| Double-click | Reset to fit |

Zoom is per file: opening another file starts unzoomed. On videos, panning only works once zoomed, and never from the control strip along the bottom, so the player's own controls keep working.

## Installation

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest), or from this repository.
2. Copy them into `<your vault>/.obsidian/plugins/explorer-arrows/`.
3. In Obsidian, go to **Settings → Community plugins**, turn off Restricted mode if it's on, and enable **Explorer Arrows**.

### With BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. **BRAT → Add Beta plugin** → `paulozac/obsidian-explorer-arrows`.

## Configuration

There's no settings tab yet. To change the Page Up/Down step, edit `PAGE` at the top of `main.js`.

## How it works, and limits

- The plugin listens for keys and mouse events in the capture phase. It only takes the arrow keys while the explorer has focus, and only after you've clicked in it.
- It reads the explorer's rows from the DOM (`.nav-file-title`, `.nav-folder-title`, `.nav-files-container`). Obsidian doesn't offer a public API for explorer navigation, so a future Obsidian release that changes this markup could break the plugin. If it stops working, disable it and Obsidian goes back to its default behaviour.
- Zoom is a CSS transform on the `<img>` or `<video>` element in Obsidian's image and video views, so it never changes the file or Obsidian's layout.
- Images embedded in notes, PDFs and audio aren't zoomed.

## License

[MIT](LICENSE) © 2026 Paulo Zacchello
