/* ============================================================
   CANOPY — app.js
   Chrome Extension (Manifest V3) — Vanilla JS
   ============================================================ */

'use strict';

// ═══════════════════════════════════════════════
//  CONSTANTS & UTILITIES
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'desktop_tab_data';
const WALLPAPER_KEY = 'desktop_tab_wallpaper';
const GRID_COL = 130;   // px width of each icon cell
const GRID_ROW = 116;   // px height of each icon cell
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}

function snapToGrid(x, y) {
  return {
    x: Math.max(0, Math.round(x / GRID_COL) * GRID_COL),
    y: Math.max(0, Math.round(y / GRID_ROW) * GRID_ROW),
  };
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function pad2(n) { return String(n).padStart(2, '0'); }

// ═══════════════════════════════════════════════
//  DATA MODEL
// ═══════════════════════════════════════════════
// Item shape:
// {
//   id: string,
//   type: 'shortcut' | 'folder',
//   title: string,
//   url: string?,         // for shortcut
//   icon: string?,        // URL or emoji; auto-favicon if null
//   emoji: string?,       // folder lucide icon name (e.g. 'folder', 'star')
//   position: {x,y},
//   children: Item[]      // only for folder
// }

let desktopData = { items: [] };

// ─── Storage ────────────────────────────────────

async function loadData() {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([STORAGE_KEY, WALLPAPER_KEY], result => {
        if (result[STORAGE_KEY]) {
          desktopData = result[STORAGE_KEY];
        }
        if (result[WALLPAPER_KEY]) {
          applyWallpaper(result[WALLPAPER_KEY]);
        }
        resolve();
      });
    } else {
      // fallback for testing outside extension
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) desktopData = JSON.parse(raw);
        const wp = localStorage.getItem(WALLPAPER_KEY);
        if (wp) applyWallpaper(wp);
      } catch {}
      resolve();
    }
  });
}

function saveData() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ [STORAGE_KEY]: desktopData });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(desktopData));
  }
}

function saveWallpaper(wp) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ [WALLPAPER_KEY]: wp });
  } else {
    localStorage.setItem(WALLPAPER_KEY, wp);
  }
}

// ═══════════════════════════════════════════════
//  WALLPAPER
// ═══════════════════════════════════════════════

const wallpaperClassMap = {
  default:  '',
  aurora:   'wallpaper-aurora',
  sunset:   'wallpaper-sunset',
  rose:     'wallpaper-rose',
  forest:   'wallpaper-forest',
  desert:   'wallpaper-desert',
  midnight: 'wallpaper-midnight',
  neon:     'wallpaper-neon',
  candy:    'wallpaper-candy',
  arctic:   'wallpaper-arctic',
  lava:     'wallpaper-lava',
  teal:     'wallpaper-teal',
  sakura:   'wallpaper-sakura',
  cosmic:   'wallpaper-cosmic',
  copper:   'wallpaper-copper',
  slate:    'wallpaper-slate',
  jungle:   'wallpaper-jungle',
  galaxy:   'wallpaper-galaxy',
};

function applyWallpaper(wp) {
  const desktop = document.getElementById('desktop');
  // remove all wallpaper classes
  desktop.classList.remove(...Object.values(wallpaperClassMap).filter(Boolean), 'wallpaper-custom');

  if (wp.startsWith('data:') || wp.startsWith('http')) {
    desktop.style.backgroundImage = `url('${wp}')`;
    desktop.classList.add('wallpaper-custom');
  } else {
    desktop.style.backgroundImage = '';
    if (wallpaperClassMap[wp]) {
      desktop.classList.add(wallpaperClassMap[wp]);
    }
  }

  // update preset UI
  document.querySelectorAll('.wp-preset').forEach(el => {
    el.classList.toggle('active', el.dataset.wp === wp);
  });
}

// ═══════════════════════════════════════════════
//  RENDER — Desktop Icons
// ═══════════════════════════════════════════════

function renderDesktop() {
  const grid = document.getElementById('desktop-grid');
  // keep only drag-placeholder if any
  Array.from(grid.children).forEach(c => {
    if (!c.classList.contains('drop-placeholder')) c.remove();
  });

  desktopData.items.forEach(item => {
    const el = createIconElement(item);
    el.style.left = item.position.x + 'px';
    el.style.top  = item.position.y + 'px';
    grid.appendChild(el);
  });
}

// ─── Lucide icon helper ─────────────────────────
function makeLucideIcon(name, size = 38) {
  const el = document.createElement('i');
  el.dataset.lucide = name;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  return el;
}

function createIconElement(item, isInFolder = false) {
  const el = document.createElement('div');
  el.className = 'desktop-icon';
  el.dataset.id = item.id;
  el.draggable = !isInFolder;

  // icon visual
  const wrap = document.createElement('div');
  wrap.className = 'icon-img-wrap';

  if (item.type === 'folder') {
    // show lucide icon + small grid of children favicons
    const iconName = item.emoji || 'folder';

    // folder stack preview
    const children = (item.children || []).slice(0, 4);
    if (children.length > 0) {
      const stack = document.createElement('div');
      stack.className = 'folder-stack';
      children.forEach(child => {
        const si = document.createElement('div');
        si.className = 'folder-stack-item';
        if (child.url) {
          const img = document.createElement('img');
          img.src = child.icon || getFaviconUrl(child.url) || '';
          img.alt = '';
          img.onerror = () => { img.style.display = 'none'; };
          si.appendChild(img);
        } else {
          si.appendChild(makeLucideIcon(child.emoji || 'folder', 14));
        }
        stack.appendChild(si);
      });
      wrap.appendChild(stack);
    } else {
      wrap.appendChild(makeLucideIcon(iconName));
    }

    // count badge
    if ((item.children || []).length > 0) {
      const badge = document.createElement('span');
      badge.className = 'folder-count';
      badge.textContent = item.children.length;
      wrap.appendChild(badge);
    }
  } else {
    // shortcut icon
    const img = document.createElement('img');
    img.className = 'icon-img';
    img.alt = item.title || '';
    img.src = item.icon || getFaviconUrl(item.url) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%237c6af7"/><text x="32" y="44" font-size="36" text-anchor="middle">🔗</text></svg>';
    img.onerror = () => {
      img.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%23302b63'/><text x='32' y='44' font-size='32' text-anchor='middle'>🔗</text></svg>`;
    };
    wrap.appendChild(img);
  }

  const label = document.createElement('span');
  label.className = 'icon-label';
  label.textContent = item.title || item.url || 'Shortcut';
  label.title = item.title || '';

  el.appendChild(wrap);
  el.appendChild(label);

  // ── Events ──
  initIconEvents(el, item, isInFolder);

  // activate lucide icons injected dynamically
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [wrap] });

  return el;
}

// ═══════════════════════════════════════════════
//  ICON EVENTS
// ═══════════════════════════════════════════════

function initIconEvents(el, item, isInFolder) {
  // Single click → open
  el.addEventListener('click', e => {
    e.stopPropagation();
    openItem(item);
  });

  // Right-click
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    selectIcon(el);
    showContextMenu(e.clientX, e.clientY, item);
  });

  // Drag — desktop icons only
  if (!isInFolder) {
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    // drop target (for folder-drop)
    el.addEventListener('dragover', e => {
      if (item.type === 'folder' && dragState.dragId !== item.id) {
        e.preventDefault();
        el.classList.add('drag-over');
      }
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (item.type === 'folder' && dragState.dragId && dragState.dragId !== item.id) {
        moveItemToFolder(dragState.dragId, item.id);
      }
    });
  }
}

function openItem(item) {
  if (item.type === 'folder') {
    openFolderOverlay(item);
  } else if (item.url) {
    window.location.href = item.url;
  }
}

// ─── Selection ────────────────────────────────

let selectedIconId = null;

function selectIcon(el) {
  document.querySelectorAll('.desktop-icon.selected').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedIconId = el.dataset.id;
}

function clearSelection() {
  document.querySelectorAll('.desktop-icon.selected').forEach(e => e.classList.remove('selected'));
  selectedIconId = null;
}

// ═══════════════════════════════════════════════
//  DRAG & DROP
// ═══════════════════════════════════════════════

const dragState = { dragId: null, offsetX: 0, offsetY: 0 };

function onDragStart(e) {
  const el = e.currentTarget;
  dragState.dragId = el.dataset.id;
  const rect = el.getBoundingClientRect();
  dragState.offsetX = e.clientX - rect.left;
  dragState.offsetY = e.clientY - rect.top;

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', el.dataset.id);

  setTimeout(() => el.classList.add('dragging'), 0);
}

function onDragEnd(e) {
  const el = e.currentTarget;
  el.classList.remove('dragging');
  dragState.dragId = null;
}

function initDesktopDropZone() {
  const grid = document.getElementById('desktop-grid');

  grid.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  grid.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragState.dragId) return;

    const grid = document.getElementById('desktop-grid');
    const rect = grid.getBoundingClientRect();
    const rawX = e.clientX - rect.left - dragState.offsetX;
    const rawY = e.clientY - rect.top  - dragState.offsetY;
    const snapped = snapToGrid(rawX, rawY);

    updateItemPosition(dragState.dragId, snapped.x, snapped.y);
    dragState.dragId = null;
  });
}

function updateItemPosition(id, x, y) {
  const item = findItem(id);
  if (!item) return;

  // clamp within grid
  const grid = document.getElementById('desktop-grid');
  const maxX = grid.offsetWidth  - GRID_COL;
  const maxY = grid.offsetHeight - GRID_ROW;
  item.position.x = Math.max(0, Math.min(x, maxX));
  item.position.y = Math.max(0, Math.min(y, maxY));

  saveData();
  renderDesktop();
}

// ═══════════════════════════════════════════════
//  CONTEXT MENU
// ═══════════════════════════════════════════════

let contextTarget = null; // item being right-clicked

function showContextMenu(x, y, item = null) {
  contextTarget = item;
  const menu = document.getElementById('context-menu');

  // show/hide item-specific options
  const editSep = document.getElementById('ctx-edit-sep');
  const editBtn = document.getElementById('ctx-edit');
  const delBtn  = document.getElementById('ctx-delete');

  if (item) {
    editSep.classList.remove('hidden');
    editBtn.classList.remove('hidden');
    delBtn.classList.remove('hidden');
  } else {
    editSep.classList.add('hidden');
    editBtn.classList.add('hidden');
    delBtn.classList.add('hidden');
  }

  menu.classList.remove('hidden');
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';

  // keep within viewport
  requestAnimationFrame(() => {
    const mr = menu.getBoundingClientRect();
    if (mr.right  > window.innerWidth)  menu.style.left = (x - mr.width)  + 'px';
    if (mr.bottom > window.innerHeight) menu.style.top  = (y - mr.height) + 'px';
  });
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
  contextTarget = null;
}

// ═══════════════════════════════════════════════
//  ADD / EDIT SHORTCUT MODAL
// ═══════════════════════════════════════════════

let editingItemId = null;
let pendingPosition = null;

function openShortcutModal(item = null, pos = null) {
  editingItemId = item ? item.id : null;
  pendingPosition = pos;

  document.getElementById('shortcut-modal-title').textContent = item ? 'Edit Shortcut' : 'Add Shortcut';
  document.getElementById('sc-url').value  = item?.url  || '';
  document.getElementById('sc-name').value = item?.title || '';
  document.getElementById('sc-icon').value = item?.icon  || '';
  document.getElementById('sc-icon-preview').innerHTML = '';

  if (item?.icon) {
    previewScIcon(item.icon);
  } else if (item?.url) {
    previewScIcon(getFaviconUrl(item.url));
  }

  document.getElementById('shortcut-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('sc-url').focus(), 50);
}

function previewScIcon(src) {
  if (!src) return;
  const preview = document.getElementById('sc-icon-preview');
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'icon preview';
  img.onerror = () => { preview.innerHTML = '<span style="color:var(--text-muted);font-size:12px">Failed to load icon</span>'; };
  preview.appendChild(img);
}

function saveShortcut() {
  const url   = document.getElementById('sc-url').value.trim();
  const title = document.getElementById('sc-name').value.trim();
  const icon  = document.getElementById('sc-icon').value.trim();

  if (!url) { toast('Please enter URL', 'error'); return; }

  // auto-add protocol
  const finalUrl = url.match(/^https?:\/\//i) ? url : 'https://' + url;
  const finalTitle = title || new URL(finalUrl).hostname.replace('www.', '');

  if (editingItemId) {
    const item = findItem(editingItemId);
    if (item) {
      item.url   = finalUrl;
      item.title = finalTitle;
      item.icon  = icon || null;
    }
    toast('Shortcut updated ✓', 'success');
  } else {
    const pos = pendingPosition || findFreePosition();
    desktopData.items.push({
      id:       uid(),
      type:     'shortcut',
      title:    finalTitle,
      url:      finalUrl,
      icon:     icon || null,
      position: pos,
      children: [],
    });
    toast('Shortcut added ✓', 'success');
  }

  saveData();
  renderDesktop();
  closeModal('shortcut-modal');
}

// ═══════════════════════════════════════════════
//  ADD / EDIT FOLDER MODAL
// ═══════════════════════════════════════════════

let editingFolderId = null;
let selectedEmoji = 'folder';

function openFolderCreateModal(item = null, pos = null) {
  editingFolderId = item ? item.id : null;
  pendingPosition = pos;
  selectedEmoji = item?.emoji || 'folder';

  document.getElementById('folder-modal-create-title').textContent = item ? 'Edit Folder' : 'Create Folder';
  document.getElementById('folder-name').value = item?.title || '';

  // reset emoji selection
  document.querySelectorAll('.emoji-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.emoji === selectedEmoji);
  });

  document.getElementById('folder-modal-create').classList.remove('hidden');
  setTimeout(() => document.getElementById('folder-name').focus(), 50);
}

function saveFolder() {
  const name = document.getElementById('folder-name').value.trim() || 'New Folder';

  if (editingFolderId) {
    const item = findItem(editingFolderId);
    if (item) {
      item.title = name;
      item.emoji = selectedEmoji;
    }
    toast('Folder updated ✓', 'success');
  } else {
    const pos = pendingPosition || findFreePosition();
    desktopData.items.push({
      id:       uid(),
      type:     'folder',
      title:    name,
      emoji:    selectedEmoji,
      url:      null,
      icon:     null,
      position: pos,
      children: [],
    });
    toast('Folder created ✓', 'success');
  }

  saveData();
  renderDesktop();
  closeModal('folder-modal-create');
}

// ═══════════════════════════════════════════════
//  FOLDER OVERLAY
// ═══════════════════════════════════════════════

let openFolderId = null;

function openFolderOverlay(item) {
  openFolderId = item.id;
  const iconName = item.emoji || 'folder';
  const titleIcon = document.createElement('i');
  titleIcon.dataset.lucide = iconName;
  titleIcon.style.cssText = 'width:16px;height:16px;vertical-align:middle;margin-right:6px';
  const titleEl = document.getElementById('folder-modal-title');
  titleEl.innerHTML = '';
  titleEl.appendChild(titleIcon);
  titleEl.appendChild(document.createTextNode(item.title));
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [titleEl] });

  const grid = document.getElementById('folder-modal-grid');
  grid.innerHTML = '';

  (item.children || []).forEach(child => {
    const el = createIconElement(child, true);
    el.style.position = 'static';
    // In-folder click → open
    el.addEventListener('dblclick', () => openItem(child));
    grid.appendChild(el);
  });

  // add button inside folder
  const addBtn = document.createElement('div');
  addBtn.className = 'desktop-icon add-in-folder';
  addBtn.style.position = 'static';
  addBtn.innerHTML = `
    <div class="icon-img-wrap" style="opacity:0.4">
      <i data-lucide="plus" style="width:38px;height:38px"></i>
    </div>
    <span class="icon-label" style="opacity:0.4">Add</span>`;
  addBtn.addEventListener('click', () => {
    closeModal('folder-overlay');
    openShortcutModalForFolder(item.id);
  });
  grid.appendChild(addBtn);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });

  document.getElementById('folder-overlay').classList.remove('hidden');
}

function openShortcutModalForFolder(folderId) {
  editingItemId    = null;
  editingFolderId  = folderId; // reuse for folder context
  pendingPosition  = null;

  document.getElementById('shortcut-modal-title').textContent = 'Add Shortcut to Folder';
  document.getElementById('sc-url').value  = '';
  document.getElementById('sc-name').value = '';
  document.getElementById('sc-icon').value = '';
  document.getElementById('sc-icon-preview').innerHTML = '';
  document.getElementById('shortcut-modal').classList.remove('hidden');
}

function saveShortcutToFolder() {
  const url   = document.getElementById('sc-url').value.trim();
  const title = document.getElementById('sc-name').value.trim();
  const icon  = document.getElementById('sc-icon').value.trim();

  const finalUrl = url.match(/^https?:\/\//i) ? url : 'https://' + url;
  const finalTitle = title || new URL(finalUrl).hostname.replace('www.', '');

  const folder = findItem(editingFolderId);
  if (folder) {
    folder.children = folder.children || [];
    folder.children.push({
      id:       uid(),
      type:     'shortcut',
      title:    finalTitle,
      url:      finalUrl,
      icon:     icon || null,
      children: [],
    });
    saveData();
    renderDesktop();
    toast('Added to folder ✓', 'success');
    closeModal('shortcut-modal');
    setTimeout(() => openFolderOverlay(folder), 100);
  }
}

// ─── Move item into folder ────────────────────

function moveItemToFolder(itemId, folderId) {
  const itemIdx = desktopData.items.findIndex(i => i.id === itemId);
  if (itemIdx === -1) return;
  const item   = desktopData.items[itemIdx];
  const folder = desktopData.items.find(i => i.id === folderId);
  if (!folder || folder.type !== 'folder') return;

  desktopData.items.splice(itemIdx, 1);
  folder.children = folder.children || [];
  folder.children.push(item);

  saveData();
  renderDesktop();
  toast(`Added to "${folder.title}" ✓`, 'success');
}

// ═══════════════════════════════════════════════
//  AUTO ARRANGE
// ═══════════════════════════════════════════════

/**
 * Arrange all desktop icons in a grid.
 * sortMode:  'name' | 'type' | 'default' | 'reverse'
 * direction: 'horizontal' (left→right, then down) | 'vertical' (top→bottom, then right)
 */
function autoArrange(sortMode = 'default', direction = 'horizontal') {
  const grid = document.getElementById('desktop-grid');
  const cols = Math.max(1, Math.floor((grid.offsetWidth  - 20) / GRID_COL));
  const rows = Math.max(1, Math.floor((grid.offsetHeight - 20) / GRID_ROW));

  // Copy and sort
  let items = [...desktopData.items];

  if (sortMode === 'name') {
    items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'en'));
  } else if (sortMode === 'type') {
    // folders first, then shortcuts — both sub-sorted by name
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '', 'en');
    });
  } else if (sortMode === 'reverse') {
    items.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'en'));
  }
  // 'default' keeps original order

  items.forEach((item, idx) => {
    let col, row;
    if (direction === 'vertical') {
      // Fill columns top-to-bottom first, then move right
      row = idx % rows;
      col = Math.floor(idx / rows);
    } else {
      // Fill rows left-to-right first, then move down (default)
      col = idx % cols;
      row = Math.floor(idx / cols);
    }
    item.position = { x: col * GRID_COL, y: row * GRID_ROW };
  });

  // Reorder desktopData.items to match sorted order
  desktopData.items = items;
  saveData();

  // Animate icons into place
  renderDesktop();
  document.querySelectorAll('.desktop-icon').forEach((el, i) => {
    el.style.transition = `left 0.35s cubic-bezier(0.4,0,0.2,1) ${i * 18}ms,
                           top  0.35s cubic-bezier(0.4,0,0.2,1) ${i * 18}ms,
                           opacity 0.2s ease ${i * 18}ms`;
    el.style.opacity = '0';
    requestAnimationFrame(() => { el.style.opacity = '1'; });
  });

  toast('Auto arranged ✓', 'success');
}

function showArrangeMenu(x, y) {
  const menu = document.getElementById('arrange-menu');
  menu.classList.remove('hidden');
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';

  // keep within viewport
  requestAnimationFrame(() => {
    const mr = menu.getBoundingClientRect();
    if (mr.right  > window.innerWidth)  menu.style.left = (x - mr.width)  + 'px';
    if (mr.bottom > window.innerHeight) menu.style.top  = (y - mr.height) + 'px';
  });
}

function hideArrangeMenu() {
  document.getElementById('arrange-menu').classList.add('hidden');
}

// ═══════════════════════════════════════════════
//  DELETE ITEM
// ═══════════════════════════════════════════════

function deleteItem(id) {
  const idx = desktopData.items.findIndex(i => i.id === id);
  if (idx !== -1) {
    const name = desktopData.items[idx].title;
    desktopData.items.splice(idx, 1);
    saveData();
    renderDesktop();
    toast(`Deleted "${name}"`, 'info');
  }
}

// ═══════════════════════════════════════════════
//  FIND HELPERS
// ═══════════════════════════════════════════════

function findItem(id, list = desktopData.items) {
  for (const item of list) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findItem(id, item.children);
      if (found) return found;
    }
  }
  return null;
}

function findFreePosition() {
  const occupied = new Set(desktopData.items.map(i => `${i.position.x},${i.position.y}`));
  const grid = document.getElementById('desktop-grid');
  const cols = Math.floor((grid.offsetWidth  - 20) / GRID_COL);
  const rows = Math.floor((grid.offsetHeight - 20) / GRID_ROW);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col * GRID_COL},${row * GRID_ROW}`;
      if (!occupied.has(key)) {
        return { x: col * GRID_COL, y: row * GRID_ROW };
      }
    }
  }
  return { x: 0, y: 0 };
}

// ═══════════════════════════════════════════════
//  BOOKMARK IMPORTER
// ═══════════════════════════════════════════════

function openImportModal() {
  if (typeof chrome === 'undefined' || !chrome.bookmarks) {
    toast('chrome.bookmarks API is not available outside extension', 'error');
    return;
  }

  chrome.bookmarks.getTree(tree => {
    const container = document.getElementById('bookmark-tree');
    container.innerHTML = '';
    renderBookmarkTree(tree, container, 0);
    document.getElementById('import-modal').classList.remove('hidden');
  });
}

function renderBookmarkTree(nodes, container, depth) {
  nodes.forEach(node => {
    if (node.children) {
      // it's a folder
      if (depth <= 1 && node.title === '') {
        // root nodes — just render children
        renderBookmarkTree(node.children, container, depth + 1);
        return;
      }

      const folderEl = document.createElement('div');
      folderEl.className = 'bm-folder';

      const header = document.createElement('div');
      header.className = 'bm-folder-header';

      const toggle = document.createElement('span');
      toggle.className = 'bm-toggle';
      toggle.textContent = '▶';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.bmId = node.id;
      checkbox.dataset.bmType = 'folder';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = '📁 ' + (node.title || 'Folder');

      header.appendChild(toggle);
      header.appendChild(checkbox);
      header.appendChild(nameSpan);

      const childContainer = document.createElement('div');
      childContainer.className = 'bm-children';

      header.addEventListener('click', e => {
        if (e.target === checkbox) return;
        childContainer.classList.toggle('open');
        toggle.classList.toggle('open');
      });

      // folder checkbox selects all children
      checkbox.addEventListener('change', () => {
        childContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = checkbox.checked;
        });
      });

      folderEl.appendChild(header);
      renderBookmarkTree(node.children, childContainer, depth + 1);
      folderEl.appendChild(childContainer);
      container.appendChild(folderEl);

    } else if (node.url) {
      // it's a bookmark
      const item = document.createElement('div');
      item.className = 'bm-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.bmId   = node.id;
      checkbox.dataset.bmUrl  = node.url;
      checkbox.dataset.bmTitle = node.title || node.url;

      const img = document.createElement('img');
      img.src = getFaviconUrl(node.url) || '';
      img.alt = '';
      img.onerror = () => { img.style.display = 'none'; };

      const label = document.createElement('span');
      label.textContent = node.title || node.url;
      label.title = node.url;

      item.appendChild(checkbox);
      item.appendChild(img);
      item.appendChild(label);

      item.addEventListener('click', e => {
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
      });

      container.appendChild(item);
    }
  });
}

function importSelectedBookmarks() {
  const checked = document.querySelectorAll('#bookmark-tree input[type="checkbox"]:checked[data-bm-url]');
  if (checked.length === 0) { toast('No bookmarks selected', 'error'); return; }

  let added = 0;
  checked.forEach(cb => {
    const url   = cb.dataset.bmUrl;
    const title = cb.dataset.bmTitle;
    // skip duplicates
    if (desktopData.items.some(i => i.url === url)) return;
    const pos = findFreePosition();
    desktopData.items.push({
      id:       uid(),
      type:     'shortcut',
      title:    title,
      url:      url,
      icon:     null,
      position: pos,
      children: [],
    });
    added++;
  });

  saveData();
  renderDesktop();
  closeModal('import-modal');
  toast(`Imported ${added} bookmark(s) ✓`, 'success');
}

function selectAllBookmarks(state) {
  document.querySelectorAll('#bookmark-tree input[type="checkbox"]').forEach(cb => {
    cb.checked = state;
  });
}

// ═══════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════

function exportData() {
  const json = JSON.stringify(desktopData, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'desktop-tab-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Data exported ✓', 'success');
}

function importDataFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      desktopData = JSON.parse(e.target.result);
      saveData();
      renderDesktop();
      toast('Data imported ✓', 'success');
    } catch {
      toast('Invalid JSON file', 'error');
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm('Are you sure you want to delete all data? This action cannot be undone.')) return;
  desktopData = { items: [] };
  saveData();
  renderDesktop();
  toast('All data deleted', 'info');
}

// ═══════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════

function updateClock() {
  const now = new Date();
  document.getElementById('clock-time').textContent =
    `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  document.getElementById('clock-date').textContent =
    `${DAYS[now.getDay()]}, ${pad2(now.getDate())}/${MONTHS[now.getMonth()]}`;
}

// ═══════════════════════════════════════════════
//  SEARCH BAR
// ═══════════════════════════════════════════════

function handleSearch(query) {
  query = query.trim();
  if (!query) return;

  if (query.match(/^https?:\/\//i) || query.match(/^[a-z0-9-]+\.[a-z]{2,}/i)) {
    // navigate to URL
    const url = query.match(/^https?:\/\//i) ? query : 'https://' + query;
    window.location.href = url;
  } else {
    // Google search
    window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }
}

// ═══════════════════════════════════════════════
//  MODAL HELPER
// ═══════════════════════════════════════════════

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ═══════════════════════════════════════════════
//  INIT / EVENT WIRING
// ═══════════════════════════════════════════════

async function init() {
  await loadData();
  renderDesktop();
  updateClock();
  setInterval(updateClock, 10000);
  initDesktopDropZone();
  wireEvents();
}

function wireEvents() {
  // ── Desktop background click ──
  document.getElementById('desktop').addEventListener('click', e => {
    if (e.target === document.getElementById('desktop') ||
        e.target === document.getElementById('desktop-grid')) {
      clearSelection();
      hideContextMenu();
    }
  });

  // ── Desktop right-click ──
  document.getElementById('desktop-grid').addEventListener('contextmenu', e => {
    if (e.target === document.getElementById('desktop-grid')) {
      e.preventDefault();
      clearSelection();
      // store cursor position for new items
      const rect = document.getElementById('desktop-grid').getBoundingClientRect();
      const snapped = snapToGrid(e.clientX - rect.left, e.clientY - rect.top);
      pendingPosition = snapped;
      showContextMenu(e.clientX, e.clientY, null);
    }
  });

  // ── Context menu items ──
  document.getElementById('ctx-add-shortcut').addEventListener('click', () => {
    hideContextMenu();
    openShortcutModal(null, pendingPosition);
  });

  document.getElementById('ctx-add-folder').addEventListener('click', () => {
    hideContextMenu();
    openFolderCreateModal(null, pendingPosition);
  });

  document.getElementById('ctx-edit').addEventListener('click', () => {
    const item = contextTarget;
    hideContextMenu();
    if (!item) return;
    if (item.type === 'folder') {
      openFolderCreateModal(item);
    } else {
      openShortcutModal(item);
    }
  });

  document.getElementById('ctx-delete').addEventListener('click', () => {
    const item = contextTarget;
    hideContextMenu();
    if (item) deleteItem(item.id);
  });

  document.getElementById('ctx-arrange').addEventListener('click', e => {
    e.stopPropagation();
    const rect = document.getElementById('ctx-arrange').getBoundingClientRect();
    hideContextMenu();
    showArrangeMenu(rect.right + 4, rect.top);
  });

  // ── Arrange submenu items ──
  document.querySelectorAll('.arr-item').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      hideArrangeMenu();
      autoArrange(el.dataset.sort, el.dataset.dir);
    });
  });

  document.getElementById('ctx-wallpaper').addEventListener('click', () => {
    hideContextMenu();
    document.getElementById('settings-panel').classList.remove('hidden');
  });

  // Hide context menu and arrange menu on click elsewhere
  document.addEventListener('click', () => {
    hideContextMenu();
    hideArrangeMenu();
  });

  // ── Taskbar buttons ──
  document.getElementById('btn-import').addEventListener('click', openImportModal);

  document.getElementById('btn-settings').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('settings-panel').classList.toggle('hidden');
  });

  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('hidden');
  });

  // Close settings by clicking outside the panel
  document.getElementById('desktop').addEventListener('click', e => {
    const panel = document.getElementById('settings-panel');
    if (!panel.classList.contains('hidden') && !panel.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  // ── Shortcut modal ──
  document.getElementById('sc-url').addEventListener('input', e => {
    const url = e.target.value.trim();
    if (url && !document.getElementById('sc-name').value) {
      try { document.getElementById('sc-name').value = new URL(url.match(/^https?:\/\//i) ? url : 'https://' + url).hostname.replace('www.', ''); } catch {}
    }
    if (url) previewScIcon(getFaviconUrl(url.match(/^https?:\/\//i) ? url : 'https://' + url));
  });

  document.getElementById('sc-icon').addEventListener('input', e => {
    previewScIcon(e.target.value.trim());
  });

  document.getElementById('sc-save').addEventListener('click', () => {
    // Determine context: adding to folder or desktop
    if (document.getElementById('shortcut-modal-title').textContent.includes('Folder')) {
      saveShortcutToFolder();
    } else {
      saveShortcut();
    }
  });

  document.getElementById('sc-cancel').addEventListener('click', () => closeModal('shortcut-modal'));

  document.getElementById('sc-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('sc-save').click();
  });

  // ── Folder modal ──
  document.querySelectorAll('.emoji-opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedEmoji = el.dataset.emoji;
    });
  });

  document.getElementById('folder-save').addEventListener('click', saveFolder);
  document.getElementById('folder-cancel').addEventListener('click', () => closeModal('folder-modal-create'));

  document.getElementById('folder-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('folder-save').click();
  });

  // ── Folder overlay ──
  document.getElementById('folder-modal-close').addEventListener('click', () => closeModal('folder-overlay'));
  document.getElementById('folder-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('folder-overlay')) closeModal('folder-overlay');
  });

  // ── Import modal ──
  document.getElementById('import-cancel').addEventListener('click', () => closeModal('import-modal'));
  document.getElementById('import-confirm').addEventListener('click', importSelectedBookmarks);
  document.getElementById('import-select-all').addEventListener('click', () => {
    const allChecked = [...document.querySelectorAll('#bookmark-tree input[type="checkbox"]')].every(cb => cb.checked);
    selectAllBookmarks(!allChecked);
    document.getElementById('import-select-all').textContent = allChecked ? 'Select all' : 'Deselect all';
  });

  document.getElementById('import-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('import-modal')) closeModal('import-modal');
  });

  // ── Modal close buttons ──
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // ── Wallpaper presets ──
  document.querySelectorAll('.wp-preset').forEach(el => {
    el.addEventListener('click', () => {
      const wp = el.dataset.wp;
      applyWallpaper(wp);
      saveWallpaper(wp);
    });
  });

  // ── Wallpaper upload ──
  document.getElementById('wallpaper-upload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      applyWallpaper(dataUrl);
      saveWallpaper(dataUrl);
    };
    reader.readAsDataURL(file);
  });

  // ── Settings data ──
  document.getElementById('btn-export-data').addEventListener('click', exportData);
  document.getElementById('import-data-file').addEventListener('change', e => importDataFromFile(e.target.files[0]));
  document.getElementById('btn-reset-data').addEventListener('click', resetData);

  // ── Search bar ──
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch(e.target.value);
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['shortcut-modal','folder-modal-create','import-modal','folder-overlay'].forEach(id => {
        if (!document.getElementById(id).classList.contains('hidden')) closeModal(id);
      });
      document.getElementById('settings-panel').classList.add('hidden');
      hideContextMenu();
      hideArrangeMenu();
      clearSelection();
    }
    if (e.key === 'Delete' && selectedIconId) {
      deleteItem(selectedIconId);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openShortcutModal();
    }
  });
}

// ─── Start ────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
