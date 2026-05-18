# Canopy — AGENTS.md

## What this is
Chrome extension (Manifest V3) that replaces the new tab page with a desktop-style grid of shortcuts, folders, and widgets.

**No build step. No npm. No framework.** Pure vanilla JS with ES modules.

## Developer workflow
- **Test**: Load unpacked in Chrome → `chrome://extensions` → Developer mode → Load unpacked → select repo root. Open a new tab to see it.
- **No lint, no formatter, no typecheck, no tests.** Edit files and reload the extension in Chrome to verify.
- **Reload after changes**: `chrome://extensions` → click the reload icon on the Canopy card, then open a new tab.

## Architecture
```
manifest.json          ← MV3 manifest (newtab override, permissions, CSP)
background.js          ← Service worker: context menu + proxy for Wallhaven/music APIs
newtab.html            ← SPA: all HTML, loads CSS + JS modules
styles.css             ← All styles (glassmorphism, CSS vars)
widget-themes.css      ← Widget theme styles
lucide.min.js          ← Bundled Lucide icon library (no CDN)
js/
  app.js               ← Main orchestrator (CanopyApp class), wires all modules
  utils.js             ← Constants (GRID_COL=130, GRID_ROW=116), uid(), snapToGrid(), toast()
  StorageManager.js    ← chrome.storage.local persistence layer
  DesktopRenderer.js   ← Icon rendering, CRUD, selection, auto-arrange
  DragDropManager.js   ← Drag & drop, trash zone, folder drop
  ContextMenuManager.js← Right-click context menu + arrange submenu
  ModalManager.js      ← Shortcut/folder modals + folder overlay
  BookmarkImporter.js  ← Chrome bookmark tree import
  WallpaperManager.js  ← 18 gradient presets + custom upload
  WallhavenManager.js  ← Wallhaven.cc search, preview, download
  ClockWidget.js       ← Live clock/date
  CommandPalette.js    ← /gg, /yt, /cal, /wall slash commands
  MusicPlayer.js       ← Internet radio player (genres, streaming)
  PomodoroTimer.js     ← Focus/break timer
  StickyNotesManager.js← Draggable sticky notes
  WeatherWidget.js     ← Open-Meteo weather (no API key)
  preload-wallpaper.js ← Runs BEFORE app.js to apply wallpaper immediately (prevents FOUC)
  SearchBar.js         ← ⚠️ NOT wired — imported nowhere, no #search-input in HTML
```

## Key conventions
- **Storage keys** are defined in `js/utils.js` (`STORAGE_KEY`, `WALLPAPER_KEY`, `MUSIC_CONFIG_KEY`, etc.).
- **MusicPlayer** uses `localStorage` instead of `chrome.storage.local` — unlike all other modules.
- **background.js** cannot import ES modules, so constants like `GRID_COL`/`GRID_ROW` are duplicated there.
- **preload-wallpaper.js** is a classic `<script>` (not module) and must stay that way — it runs synchronously before module loading.
- All JS modules in `js/` are ES modules (`type="module"` in HTML).
- New modules must be imported and instantiated in `js/app.js`.

## External APIs (proxied through background.js)
- Wallhaven: `wallhaven.cc`, `w.wallhaven.cc`, `th.wallhaven.cc`
- Music: `pub-1fcf1661114842b0b4459512cb05dd05.r2.dev`, `r2-music-api.larx-update.workers.dev`
- Weather: `api.open-meteo.com`, `geocoding-api.open-meteo.com`

The service worker proxies these to bypass extension-page CORS restrictions. New API origins must be added to both `manifest.json` `host_permissions` and `content_security_policy` `connect-src`, and proxied via `background.js` message handlers.

## Gotchas
- `SearchBar.js` exists but is dead code — do not try to use it without also adding the HTML element and wiring it in `app.js`.
- No unit test infrastructure exists. Manual testing via Chrome reload is the only verification.
- The `carnopy_more_feature.md` file is an AI brainstorming session log, not a spec or requirements doc.
