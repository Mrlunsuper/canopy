<div align="center">

# 🌿 Canopy

**A beautiful, minimal new tab Chrome extension — your personal desktop in the browser.**

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-7c6af7)
![License](https://img.shields.io/badge/license-MIT-22c55e)

</div>

---

## ✨ Features

- **Desktop-style icon grid** — drag & drop shortcuts anywhere on screen
- **Folders** — group shortcuts into folders with custom Lucide icons
- **Clock & search** — centered clock with live date and a quick-launch search bar
- **18 gradient wallpapers** — curated dark themes, one click to switch
- **Custom wallpaper** — upload your own image
- **Bookmark importer** — import from Chrome bookmarks in one click
- **Auto-arrange** — sort icons by name, type, or order; horizontal or vertical
- **Right-click context menu** — add, edit, delete shortcuts and folders
- **Export / Import data** — back up and restore your layout as JSON
- **Glassmorphism UI** — frosted-glass panels, smooth animations, Inter font

---

## 📸 Preview

> Open a new tab after installing to see Canopy in action.

---

## 🚀 Installation

Canopy is a local extension loaded in developer mode — no Chrome Web Store required.

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/your-username/canopy.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (top-right toggle).

4. Click **Load unpacked** and select the `canopy/` folder.

5. Open a **new tab** — Canopy replaces the default new tab page.

---

## 🗂️ Project Structure

```
canopy/
├── manifest.json     # Chrome Manifest V3 config
├── newtab.html       # Main new tab page
├── app.js            # All extension logic (vanilla JS)
├── styles.css        # All styles (vanilla CSS, glassmorphism)
├── lucide.min.js     # Lucide icon library (bundled locally)
├── icon16.png        # Extension icon 16×16
├── icon48.png        # Extension icon 48×48
└── icon128.png       # Extension icon 128×128
```

---

## 🎨 Wallpaper Themes

| Theme | Description |
|---|---|
| Nebula | Deep purple-indigo (default) |
| Aurora | Dark green-teal |
| Ocean Night | Navy steel blue |
| Violet | Deep plum |
| Forest | Dark pine green |
| Ember | Dark amber-brown |
| Midnight | Pure black-navy |
| Neon Abyss | Electric indigo |
| Candy | Deep magenta-purple |
| Arctic | Cold steel blue |
| Lava | Dark crimson |
| Teal Deep | Dark aqua |
| Sakura | Deep burgundy-rose |
| Cosmic Blue | Indigo-navy space |
| Copper | Dark bronze |
| Slate | Cool grey-blue |
| Jungle | Shadowy deep green |
| Galaxy | Multi-tone deep space |

---

## 🖱️ Usage

| Action | How |
|---|---|
| Add shortcut | Right-click on desktop → **Add Shortcut** |
| Add folder | Right-click on desktop → **Create Folder** |
| Move icon | Drag & drop |
| Drop into folder | Drag a shortcut onto a folder icon |
| Open folder | Single click the folder |
| Edit / Delete | Right-click the icon |
| Auto-arrange | Right-click → **Auto Arrange** |
| Change wallpaper | Settings panel (top-right ⚙️ button) |
| Close settings | Click anywhere outside the panel |
| Import bookmarks | Top-right bookmark button |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Logic | Vanilla JavaScript (ES2021) |
| Styling | Vanilla CSS (glassmorphism, CSS variables) |
| Icons | [Lucide](https://lucide.dev) (bundled, no CDN) |
| Storage | `chrome.storage.local` |
| Fonts | Inter (Google Fonts) |
| Platform | Chrome Manifest V3 |

> **No build step. No framework. No dependencies beyond Lucide.**

---

## 🔒 Permissions

| Permission | Reason |
|---|---|
| `bookmarks` | Import Chrome bookmarks |
| `storage` | Persist your layout and wallpaper |
| `favicon` | Fetch website favicons automatically |

---

## 📦 Data Backup

You can export your entire desktop layout (shortcuts, folders, positions) as a JSON file from the **Settings panel → Export JSON data**. Import it back anytime, or use it to sync across machines.

---

## 📄 License

MIT — do whatever you want with it.

---

<div align="center">
  Made with ☕ and vanilla JS &nbsp;·&nbsp; <strong>Canopy v1.0.0</strong>
</div>
