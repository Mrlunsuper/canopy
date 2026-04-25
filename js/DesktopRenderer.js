/* ============================================================
   CANOPY — js/DesktopRenderer.js
   Icon rendering, CRUD, selection, and auto-arrange
   ============================================================ */

import { GRID_COL, GRID_ROW, uid, getFaviconUrl, toast } from './utils.js';

export class DesktopRenderer {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   * @param {import('./DragDropManager.js').DragDropManager} dragDrop
   * @param {Function} onIconOpen — callback(item) when an icon is opened
   * @param {Function} onIconContext — callback(x, y, item) on right-click
   */
  constructor(storage, dragDrop, onIconOpen, onIconContext) {
    this.storage      = storage;
    this.dragDrop     = dragDrop;
    this.onIconOpen   = onIconOpen;
    this.onIconContext = onIconContext;

    this.selectedIconId = null;
  }

  // ═══════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════

  /**
   * Re-render all desktop icons.
   */
  render() {
    const grid = document.getElementById('desktop-grid');
    // keep only drag-placeholder if any
    Array.from(grid.children).forEach(c => {
      if (!c.classList.contains('drop-placeholder')) c.remove();
    });

    this.storage.data.items.forEach(item => {
      const el = this.createIconElement(item);
      el.style.left = item.position.x + 'px';
      el.style.top  = item.position.y + 'px';
      grid.appendChild(el);
    });
  }

  // ═══════════════════════════════════════════════
  //  ICON ELEMENT CREATION
  // ═══════════════════════════════════════════════

  /**
   * Create a Lucide icon <i> element.
   * @param {string} name — Lucide icon name
   * @param {number} [size=38]
   * @returns {HTMLElement}
   */
  makeLucideIcon(name, size = 38) {
    const el = document.createElement('i');
    el.dataset.lucide = name;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    return el;
  }

  /**
   * Create a desktop icon DOM element for the given item.
   * @param {object} item
   * @param {boolean} [isInFolder=false]
   * @returns {HTMLElement}
   */
  createIconElement(item, isInFolder = false) {
    const el = document.createElement('div');
    el.className  = 'desktop-icon';
    el.dataset.id = item.id;
    el.draggable  = !isInFolder;

    // icon visual
    const wrap = document.createElement('div');
    wrap.className = 'icon-img-wrap';

    if (item.type === 'folder') {
      this._buildFolderVisual(item, wrap);
    } else {
      this._buildShortcutVisual(item, wrap);
    }

    const label = document.createElement('span');
    label.className   = 'icon-label';
    label.textContent = item.title || item.url || 'Shortcut';
    label.title       = item.title || '';

    el.appendChild(wrap);
    el.appendChild(label);

    // ── Events ──
    this._initIconEvents(el, item, isInFolder);

    // activate lucide icons injected dynamically
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [wrap] });

    return el;
  }

  /** @private */
  _buildFolderVisual(item, wrap) {
    const iconName = item.emoji || 'folder';
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
          si.appendChild(this.makeLucideIcon(child.emoji || 'folder', 14));
        }
        stack.appendChild(si);
      });
      wrap.appendChild(stack);
    } else {
      wrap.appendChild(this.makeLucideIcon(iconName));
    }

    // count badge
    if ((item.children || []).length > 0) {
      const badge = document.createElement('span');
      badge.className   = 'folder-count';
      badge.textContent = item.children.length;
      wrap.appendChild(badge);
    }
  }

  /** @private */
  _buildShortcutVisual(item, wrap) {
    const img = document.createElement('img');
    img.className = 'icon-img';
    img.alt = item.title || '';
    img.src = item.icon || getFaviconUrl(item.url) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%237c6af7"/><text x="32" y="44" font-size="36" text-anchor="middle">🔗</text></svg>';
    img.onerror = () => {
      img.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%23302b63'/><text x='32' y='44' font-size='32' text-anchor='middle'>🔗</text></svg>`;
    };
    wrap.appendChild(img);
  }

  // ═══════════════════════════════════════════════
  //  ICON EVENTS
  // ═══════════════════════════════════════════════

  /** @private */
  _initIconEvents(el, item, isInFolder) {
    // Single click → open
    el.addEventListener('click', e => {
      e.stopPropagation();
      this.onIconOpen(item);
    });

    // Right-click
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      this.selectIcon(el);
      this.onIconContext(e.clientX, e.clientY, item);
    });

    // Drag — desktop icons only
    if (!isInFolder) {
      el.addEventListener('dragstart', e => this.dragDrop.onDragStart(e));
      el.addEventListener('dragend', e => this.dragDrop.onDragEnd(e));

      // drop target (for folder-drop)
      el.addEventListener('dragover', e => {
        if (item.type === 'folder' && this.dragDrop.dragId !== item.id) {
          e.preventDefault();
          el.classList.add('drag-over');
        }
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (item.type === 'folder' && this.dragDrop.dragId && this.dragDrop.dragId !== item.id) {
          this.dragDrop.moveItemToFolder(this.dragDrop.dragId, item.id);
        }
      });
    }
  }

  // ═══════════════════════════════════════════════
  //  SELECTION
  // ═══════════════════════════════════════════════

  /**
   * Select a desktop icon.
   * @param {HTMLElement} el
   */
  selectIcon(el) {
    document.querySelectorAll('.desktop-icon.selected').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedIconId = el.dataset.id;
  }

  /**
   * Clear current selection.
   */
  clearSelection() {
    document.querySelectorAll('.desktop-icon.selected').forEach(e => e.classList.remove('selected'));
    this.selectedIconId = null;
  }

  // ═══════════════════════════════════════════════
  //  ITEM CRUD
  // ═══════════════════════════════════════════════

  /**
   * Add a shortcut to the desktop.
   * @param {object} opts
   * @param {string} opts.url
   * @param {string} opts.title
   * @param {string|null} opts.icon
   * @param {{x:number, y:number}} [opts.position]
   * @returns {object} the created item
   */
  addShortcut({ url, title, icon, position }) {
    const pos = position || this.findFreePosition();
    const item = {
      id:       uid(),
      type:     'shortcut',
      title,
      url,
      icon:     icon || null,
      position: pos,
      children: [],
    };
    this.storage.data.items.push(item);
    this.storage.saveData();
    this.render();
    return item;
  }

  /**
   * Add a folder to the desktop.
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} opts.emoji
   * @param {{x:number, y:number}} [opts.position]
   * @returns {object} the created item
   */
  addFolder({ title, emoji, position }) {
    const pos = position || this.findFreePosition();
    const item = {
      id:       uid(),
      type:     'folder',
      title,
      emoji,
      url:      null,
      icon:     null,
      position: pos,
      children: [],
    };
    this.storage.data.items.push(item);
    this.storage.saveData();
    this.render();
    return item;
  }

  /**
   * Delete a desktop item by ID.
   * @param {string} id
   */
  deleteItem(id) {
    const data = this.storage.data;
    const idx = data.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const name = data.items[idx].title;
      data.items.splice(idx, 1);
      this.storage.saveData();
      this.render();
      toast(`Deleted "${name}"`, 'info');
    }
  }

  /**
   * Find the first unoccupied grid position.
   * @returns {{x: number, y: number}}
   */
  findFreePosition() {
    const data = this.storage.data;
    const occupied = new Set(data.items.map(i => `${i.position.x},${i.position.y}`));
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
  //  AUTO ARRANGE
  // ═══════════════════════════════════════════════

  /**
   * Auto-arrange all desktop icons in a grid.
   * @param {'name'|'type'|'default'|'reverse'} sortMode
   * @param {'horizontal'|'vertical'} direction
   */
  autoArrange(sortMode = 'default', direction = 'horizontal') {
    const grid = document.getElementById('desktop-grid');
    const cols = Math.max(1, Math.floor((grid.offsetWidth  - 20) / GRID_COL));
    const rows = Math.max(1, Math.floor((grid.offsetHeight - 20) / GRID_ROW));

    // Copy and sort
    let items = [...this.storage.data.items];

    if (sortMode === 'name') {
      items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'en'));
    } else if (sortMode === 'type') {
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
        row = idx % rows;
        col = Math.floor(idx / rows);
      } else {
        col = idx % cols;
        row = Math.floor(idx / cols);
      }
      item.position = { x: col * GRID_COL, y: row * GRID_ROW };
    });

    this.storage.data.items = items;
    this.storage.saveData();

    // Animate icons into place
    this.render();
    document.querySelectorAll('.desktop-icon').forEach((el, i) => {
      el.style.transition = `left 0.35s cubic-bezier(0.4,0,0.2,1) ${i * 18}ms,
                             top  0.35s cubic-bezier(0.4,0,0.2,1) ${i * 18}ms,
                             opacity 0.2s ease ${i * 18}ms`;
      el.style.opacity = '0';
      requestAnimationFrame(() => { el.style.opacity = '1'; });
    });

    toast('Auto arranged ✓', 'success');
  }
}
