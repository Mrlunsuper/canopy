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

    if (typeof lucide !== 'undefined') lucide.createIcons();
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
    el.draggable  = true;

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
    this._initIconEvents(el, item, isInFolder, label);

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
          img.draggable = false;
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
    img.draggable = false;
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
  _initIconEvents(el, item, isInFolder, label) {
    if (isInFolder) {
      // In-folder: double-click to open (single click is reserved for drag)
      el.addEventListener('dblclick', e => {
        if (e.target.closest('.icon-label')) return; // handled by label dblclick
        e.stopPropagation();
        this.onIconOpen(item);
      });
    } else {
      // Desktop: single click on icon image to open, but NOT on label
      el.addEventListener('click', e => {
        e.stopPropagation();
        // Don't navigate if clicking the label (label has its own dblclick for rename)
        if (e.target.closest('.icon-label')) {
          this.selectIcon(el);
          return;
        }
        this.onIconOpen(item);
      });
    }

    // Double-click on label → inline rename
    label.addEventListener('dblclick', e => {
      e.stopPropagation();
      e.preventDefault();
      this.startRename(item.id);
    });

    // Right-click
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      this.selectIcon(el);
      this.onIconContext(e.clientX, e.clientY, item);
    });

    // Drag
    el.addEventListener('dragstart', e => this.dragDrop.onDragStart(e));
    el.addEventListener('dragend', e => this.dragDrop.onDragEnd(e));

    // Drop target — desktop icons only
    if (!isInFolder) {
      el.addEventListener('dragover', e => {
        if (this.dragDrop.dragId && this.dragDrop.dragId !== item.id) {
          e.preventDefault();
          el.classList.add('drag-over');
        }
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over');
        if (this.dragDrop.dragId && this.dragDrop.dragId !== item.id) {
          if (item.type === 'folder') {
            this.dragDrop.moveItemToFolder(this.dragDrop.dragId, item.id);
          } else {
            // Dragged onto a shortcut -> create a new folder containing both
            this.dragDrop.createFolderFromItems(this.dragDrop.dragId, item.id);
          }
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
  //  INLINE RENAME
  // ═══════════════════════════════════════════════

  /**
   * Enter inline rename mode for the given item.
   * @param {string} id
   */
  startRename(id) {
    // Cancel any existing rename first
    this._cancelActiveRename();

    const item = this.storage.findItem(id);
    if (!item) return;

    // Find the DOM element
    const el = document.querySelector(`.desktop-icon[data-id="${id}"]`);
    if (!el) return;

    this.selectIcon(el);

    const label = el.querySelector('.icon-label');
    if (!label) return;

    // Store original value for cancel
    label.dataset.originalTitle = label.textContent;
    label.contentEditable = 'true';
    label.classList.add('editing');
    el.draggable = false;  // disable drag while renaming

    // Remove text truncation so user can see full name
    label.style.overflow = 'visible';
    label.style.textOverflow = 'unset';
    label.style.whiteSpace = 'normal';
    label.style.wordBreak = 'break-word';

    // Select all text
    requestAnimationFrame(() => {
      label.focus();
      const range = document.createRange();
      range.selectNodeContents(label);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    // Store handler references so we can remove them later
    const onKeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._commitRename(label, item, el);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._cancelRename(label, el);
      }
      // Stop all key events from propagating while editing
      e.stopPropagation();
    };

    const onBlur = () => {
      // Small delay to allow click handlers to fire first
      setTimeout(() => {
        if (label.contentEditable === 'true') {
          this._commitRename(label, item, el);
        }
      }, 100);
    };

    // Prevent click on label from bubbling (would trigger navigation)
    const onClick = e => {
      e.stopPropagation();
      e.preventDefault();
    };

    label.addEventListener('keydown', onKeydown);
    label.addEventListener('blur', onBlur);
    label.addEventListener('click', onClick);

    // Store references for cleanup
    label._renameHandlers = { onKeydown, onBlur, onClick };
  }

  /** @private */
  _commitRename(label, item, el) {
    const newTitle = label.textContent.trim();
    this._exitRenameMode(label, el);

    if (newTitle && newTitle !== item.title) {
      item.title = newTitle;
      this.storage.saveData();
      // Update label and tooltip
      label.textContent = newTitle;
      label.title = newTitle;
      toast(`Renamed to "${newTitle}"`, 'success');
    } else {
      // Restore original if empty or unchanged
      label.textContent = label.dataset.originalTitle || item.title;
    }
  }

  /** @private */
  _cancelRename(label, el) {
    label.textContent = label.dataset.originalTitle || label.textContent;
    this._exitRenameMode(label, el);
  }

  /** @private */
  _cancelActiveRename() {
    const editing = document.querySelector('.icon-label.editing');
    if (editing) {
      const el = editing.closest('.desktop-icon');
      this._cancelRename(editing, el);
    }
  }

  /** @private */
  _exitRenameMode(label, el) {
    label.contentEditable = 'false';
    label.classList.remove('editing');
    if (el) el.draggable = true;

    // Restore text truncation
    label.style.overflow = '';
    label.style.textOverflow = '';
    label.style.whiteSpace = '';
    label.style.wordBreak = '';

    delete label.dataset.originalTitle;

    // Remove event listeners
    if (label._renameHandlers) {
      label.removeEventListener('keydown', label._renameHandlers.onKeydown);
      label.removeEventListener('blur', label._renameHandlers.onBlur);
      label.removeEventListener('click', label._renameHandlers.onClick);
      delete label._renameHandlers;
    }
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
    this.autoArrange();
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
    this.autoArrange();
    return item;
  }

  /**
   * Move an item from a folder back to the desktop.
   * @param {string} id 
   */
  moveItemToDesktop(id, pos) {
    const item = this.storage.removeItem(id);
    if (item) {
      item.position = pos || this.findFreePosition();
      this.storage.data.items.push(item);
      this.storage.saveData();
      this.render();

      document.dispatchEvent(new CustomEvent('canopy-item-moved-desktop', { detail: { id } }));

      toast(`Moved "${item.title}" to desktop`, 'success');
    }
  }

  /**
   * Delete a desktop item by ID.
   * @param {string} id
   */
  deleteItem(id) {
    const removed = this.storage.removeItem(id);
    if (removed) {
      this.storage.saveData();
      this.render();
      
      // If the removed item was a folder, we might need to close the overlay
      // if it's currently open. We handle this in ModalManager or let user close it.
      
      // Also, if the item was inside a folder, we need to refresh the folder overlay.
      // Easiest way is to dispatch a custom event or check if we are in app.js
      // For now, just dispatch an event so ModalManager can catch it.
      document.dispatchEvent(new CustomEvent('canopy-item-deleted', { detail: { id } }));

      toast(`Deleted "${removed.title}"`, 'info');
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
