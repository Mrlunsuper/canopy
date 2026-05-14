/* ============================================================
   CANOPY — background.js
   Service worker: registers browser context-menu entry
   "Add to Canopy" and writes the page as a shortcut to storage.
   ============================================================ */

const STORAGE_KEY = 'desktop_tab_data';
// Mirrors js/utils.js — service worker can't import ES modules
const GRID_COL    = 130;
const GRID_ROW    = 116;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Proxy Wallhaven API requests (bypass CORS) ────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'wallhaven-search') {
    fetch(request.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (request.type === 'wallhaven-download') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: true,
    });
    return false;
  }

  if (request.type === 'music-sync') {
    fetch(request.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// ─── Create context menu on install ───────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'add-to-canopy',
    title:    'Add to Canopy',
    contexts: ['page'],
  });
});

// ─── Handle context menu click ────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'add-to-canopy') return;

  const url   = info.pageUrl || tab.url;
  const title = tab.title || new URL(url).hostname.replace('www.', '');
  const icon  = tab.favIconUrl || null;

  chrome.storage.local.get([STORAGE_KEY], result => {
    const data = result[STORAGE_KEY] || { items: [] };

    // Prevent duplicate — skip if same URL already exists at the top level
    const exists = data.items.some(i => i.url === url);
    if (exists) {
      // Notify user the page is already on the desktop
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4ade80', tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
      return;
    }

    // Find free grid position
    const occupied = new Set(data.items.map(i => `${i.position.x},${i.position.y}`));
    let pos = { x: 0, y: 0 };
    // Scan a generous grid (20 cols × 20 rows) to find a free slot
    outer:
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 20; col++) {
        const key = `${col * GRID_COL},${row * GRID_ROW}`;
        if (!occupied.has(key)) {
          pos = { x: col * GRID_COL, y: row * GRID_ROW };
          break outer;
        }
      }
    }

    const item = {
      id:       uid(),
      type:     'shortcut',
      title,
      url,
      icon:     icon || null,
      position: pos,
      children: [],
    };

    data.items.push(item);
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
      // Brief badge feedback on the extension icon
      chrome.action.setBadgeText({ text: '+1', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#7c6af7', tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
    });
  });
});
