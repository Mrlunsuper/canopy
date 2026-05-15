/* ============================================================
   CANOPY — background.js
   Service worker: registers browser context-menu entry
   "Add to Canopy" and writes the page as a shortcut to storage.
   ============================================================ */

const STORAGE_KEY = 'desktop_tab_data';
// Mirrors js/utils.js — service worker can't import ES modules
const GRID_COL    = 130;
const GRID_ROW    = 116;

const WALLHAVEN_API_ORIGIN = 'https://wallhaven.cc';
const WALLHAVEN_IMAGE_ORIGIN = 'https://w.wallhaven.cc';
const MUSIC_INDEX_ORIGIN = 'https://pub-1fcf1661114842b0b4459512cb05dd05.r2.dev';
const MAX_PROXY_BYTES = 1024 * 1024;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function parseHttpsUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;

  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function isWallhavenSearchUrl(rawUrl) {
  const url = parseHttpsUrl(rawUrl);
  return Boolean(url && url.origin === WALLHAVEN_API_ORIGIN && url.pathname === '/api/v1/search');
}

function isWallhavenDownloadUrl(rawUrl) {
  const url = parseHttpsUrl(rawUrl);
  return Boolean(url && url.origin === WALLHAVEN_IMAGE_ORIGIN && url.pathname.startsWith('/full/'));
}

function isMusicIndexUrl(rawUrl) {
  const url = parseHttpsUrl(rawUrl);
  return Boolean(url && url.origin === MUSIC_INDEX_ORIGIN && url.pathname === '/index.json');
}

function sanitizeDownloadFilename(filename) {
  const safeName = typeof filename === 'string' ? filename : 'wallhaven-download.jpg';
  return safeName
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'wallhaven-download.jpg';
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_PROXY_BYTES) {
    throw new Error('Response too large');
  }

  return res.json();
}

// ─── Proxy trusted remote JSON requests ────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'wallhaven-search') {
    if (!isWallhavenSearchUrl(request.url)) {
      sendResponse({ ok: false, error: 'Blocked untrusted Wallhaven URL' });
      return false;
    }

    fetchJson(request.url)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (request.type === 'wallhaven-download') {
    if (!isWallhavenDownloadUrl(request.url)) {
      sendResponse({ ok: false, error: 'Blocked untrusted download URL' });
      return false;
    }

    chrome.downloads.download({
      url: request.url,
      filename: sanitizeDownloadFilename(request.filename),
      saveAs: true,
    }, downloadId => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, downloadId });
    });
    return true;
  }

  if (request.type === 'music-sync') {
    if (!isMusicIndexUrl(request.url)) {
      sendResponse({ ok: false, error: 'Blocked untrusted music index URL' });
      return false;
    }

    fetchJson(request.url)
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
