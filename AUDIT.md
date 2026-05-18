# Canopy Audit

**Date:** Fri May 15 2026

---

## STRUCTURE

### Good
- Clean module separation — each concern has its own file
- No build step, no dependencies beyond bundled `lucide.min.js`
- `app.js` acts as a clear orchestrator
- `preload-wallpaper.js` correctly prevents FOUC

### Issues

1. **Dead code**: `js/SearchBar.js` is imported nowhere and has no HTML element. Delete it.

2. **Inconsistent storage**: `MusicPlayer.js` uses `localStorage` exclusively while every other module uses `chrome.storage.local`. This means music config won't sync across Chrome profiles. (`js/MusicPlayer.js:244-291`)

3. **Duplicated constants**: `GRID_COL`/`GRID_ROW` and `STORAGE_KEY` are duplicated in `background.js` because service workers can't import ES modules. This is documented but fragile — if you change one, the other breaks silently. (`background.js:7-10`)

4. **Version mismatch**: `manifest.json` says `"version": "1.1.0"` but `newtab.html` settings panel says "Version 2.0.0". (`manifest.json:4`, `newtab.html:362`)

5. **`app.js` is a god constructor**: 75 lines of `this.xxx = new Yyy()` followed by 13 sequential `init()` calls. Consider lazy-init for widgets the user might not use. (`js/app.js:25-75`)

6. **No cleanup**: No module exposes a `destroy()` method. The extension never tears down intervals, event listeners, or AudioContexts. If Chrome suspends/reloads the service worker, orphaned timers accumulate.

---

## SECURITY

### Good
- CSP is tight: `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`
- Background worker validates URLs against allowlists before proxying (`background.js:74-117`)
- Download filenames are sanitized (`background.js:53-59`)
- `fetchJson` checks `content-length` against `MAX_PROXY_BYTES` (`background.js:65-68`)
- Calculator uses a custom tokenizer/parser instead of `eval()` (`js/CommandPalette.js:174-300`)
- Paste sanitization in sticky notes strips HTML (`js/StickyNotesManager.js:269-272`)

### Issues

1. **XSS via `innerHTML` in WeatherWidget**: `_render()` uses template literals with `innerHTML` containing user-influenced data (temperature, humidity, wind speed from API). While Open-Meteo is trusted, if the API were compromised these would execute. (`js/WeatherWidget.js:292-305`)

2. **XSS via `innerHTML` in CommandPalette**: `_tryShowCalc` uses `innerHTML` with `_escapeHtml(expr)` — this is correct, but the pattern is fragile. (`js/CommandPalette.js:150-153`)

3. **`window.location.href` navigation to user-supplied URLs**: Clicking a shortcut navigates directly via `window.location.href = item.url`. The URL is user-controlled via the modal. No validation that it's a valid `http(s)://` URL. A malicious import or manual entry of `javascript:...` would be blocked by CSP, but `data:text/html,...` might not be. (`js/app.js:143`)

4. **Geolocation permission in manifest**: `"geolocation"` is listed in permissions but the code gracefully handles denial. However, having it in the manifest triggers a permission warning on install. Consider using it only on-demand without declaring it if possible (MV3 may require it though). (`manifest.json:12`)

5. **`downloads` permission**: Used only for Wallhaven wallpaper downloads. This is a broad permission — the extension can initiate any download. (`manifest.json:11`, `background.js:93-104`)

6. **No nonce or integrity for `lucide.min.js`**: Loaded as a classic script with no SRI hash. If the file on disk is tampered with, it executes with full extension privileges. (`newtab.html:10`)

7. **`document.execCommand('insertText', ...)`**: Deprecated API used for paste sanitization. Works but should be replaced with `Selection`/`Range` API. (`js/StickyNotesManager.js:272`)

---

## PERFORMANCE

### Good
- `img` elements use `loading="lazy"` for Wallhaven thumbnails (`js/WallhavenManager.js:223`)
- Sticky notes debounce saves at 600ms (`js/StickyNotesManager.js:4`)
- Weather data cached in `localStorage` with 15-min refresh (`js/WeatherWidget.js:10`)
- Clock updates every 10s, not every second (`js/ClockWidget.js:192`)
- `preload-wallpaper.js` runs synchronously to avoid FOUC

### Issues

1. **Full re-render on every storage change**: `DesktopRenderer.render()` wipes and rebuilds ALL icons on every change (`innerHTML`-equivalent via `remove()` + `appendChild`). For 50+ shortcuts this is janky. Use DOM diffing or keyed updates. (`js/DesktopRenderer.js:31-46`)

2. **`lucide.createIcons()` called on entire document after every render**: This walks the whole DOM tree. Should scope to the newly-inserted container. (`js/DesktopRenderer.js:45`)

3. **No debouncing on drag-drop position saves**: Every pixel of drag triggers `saveData()` → `chrome.storage.local.set()` → full render. Should throttle to ~100ms. (`js/DragDropManager.js:141-154`)

4. **`autoArrange()` called after every add**: `addShortcut` and `addFolder` both call `autoArrange()` which re-sorts and re-positions ALL items. If the user explicitly placed an item, auto-arrange overwrites that. (`js/DesktopRenderer.js:408`, `js/DesktopRenderer.js:434`)

5. **Music player progress bar**: `timeupdate` fires ~4-25 times/sec and calls `_updateProgressDisplay()` which does DOM writes. Not throttled. (`js/MusicPlayer.js:723-725`)

6. **Wallhaven image URL construction**: `_getImageUrl` constructs URLs from `wp.id` and `wp.file_type` without validating format. If Wallhaven changes their URL scheme, all downloads break. (`js/WallhavenManager.js:198-204`)

7. **`findFreePosition` scans the entire grid**: O(n) where n = visible grid cells. Called on every add and every import. For a 1920×1080 screen that's ~150 cells. Not critical but could be optimized with a Set of occupied positions. (`js/DesktopRenderer.js:482-498`)

8. **No requestAnimationFrame for wallpaper preload**: `WallpaperManager.apply` sets `backgroundImage` immediately, then preloads. On slow connections the user sees a flash. The preload should happen first. (`js/WallpaperManager.js:62-75`)

---

## SUMMARY — Priority Fixes

| Severity | Issue | File |
|----------|-------|------|
| **HIGH** | `autoArrange()` overwrites manual positions on every add | `DesktopRenderer.js:408,434` |
| **HIGH** | Full DOM rebuild on every storage change | `DesktopRenderer.js:31-46` |
| **MEDIUM** | MusicPlayer uses `localStorage` instead of `chrome.storage` | `MusicPlayer.js:244-291` |
| **MEDIUM** | No drag position throttle | `DragDropManager.js:141-154` |
| **MEDIUM** | Version mismatch manifest vs settings | `manifest.json:4`, `newtab.html:362` |
| **LOW** | Dead `SearchBar.js` file | `js/SearchBar.js` |
| **LOW** | `document.execCommand` deprecated | `StickyNotesManager.js:272` |
| **LOW** | `lucide.createIcons()` on full document | `DesktopRenderer.js:45` |
