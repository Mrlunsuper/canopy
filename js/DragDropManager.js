/* ============================================================
   CANOPY — js/DragDropManager.js
   Drag & drop state and event handling
   ============================================================ */

import { GRID_COL, GRID_ROW, snapToGrid, toast } from './utils.js';

export class DragDropManager {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   * @param {Function} renderCallback — called after position/folder changes
   */
  constructor(storage, renderCallback) {
    this.storage = storage;
    this.renderCallback = renderCallback;

    /** @private */
    this._dragId  = null;
    this._offsetX = 0;
    this._offsetY = 0;
  }

  /** @returns {string|null} Currently dragged item ID */
  get dragId() {
    return this._dragId;
  }

  // ─── Handlers ────────────────────────────────

  /**
   * Handle dragstart on a desktop icon.
   * @param {DragEvent} e
   */
  onDragStart(e) {
    const el = e.currentTarget;
    this._dragId = el.dataset.id;
    const rect = el.getBoundingClientRect();
    this._offsetX = e.clientX - rect.left;
    this._offsetY = e.clientY - rect.top;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.id);

    setTimeout(() => el.classList.add('dragging'), 0);
  }

  /**
   * Handle dragend on a desktop icon.
   * @param {DragEvent} e
   */
  onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    this._dragId = null;
  }

  // ─── Drop Zone ───────────────────────────────

  /**
   * Initialize the desktop grid as a drop zone.
   */
  initDropZone() {
    const grid = document.getElementById('desktop-grid');

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      if (!this._dragId) return;

      const gridEl = document.getElementById('desktop-grid');
      const rect = gridEl.getBoundingClientRect();
      const rawX = e.clientX - rect.left - this._offsetX;
      const rawY = e.clientY - rect.top  - this._offsetY;
      const snapped = snapToGrid(rawX, rawY);

      this.updateItemPosition(this._dragId, snapped.x, snapped.y);
      this._dragId = null;
    });
  }

  /**
   * Update an item's grid position.
   * @param {string} id
   * @param {number} x
   * @param {number} y
   */
  updateItemPosition(id, x, y) {
    const item = this.storage.findItem(id);
    if (!item) return;

    // clamp within grid
    const grid = document.getElementById('desktop-grid');
    const maxX = grid.offsetWidth  - GRID_COL;
    const maxY = grid.offsetHeight - GRID_ROW;
    item.position.x = Math.max(0, Math.min(x, maxX));
    item.position.y = Math.max(0, Math.min(y, maxY));

    this.storage.saveData();
    this.renderCallback();
  }

  // ─── Folder Drop ─────────────────────────────

  /**
   * Move a desktop item into a folder.
   * @param {string} itemId
   * @param {string} folderId
   */
  moveItemToFolder(itemId, folderId) {
    const data = this.storage.data;
    const itemIdx = data.items.findIndex(i => i.id === itemId);
    if (itemIdx === -1) return;

    const item   = data.items[itemIdx];
    const folder = data.items.find(i => i.id === folderId);
    if (!folder || folder.type !== 'folder') return;

    data.items.splice(itemIdx, 1);
    folder.children = folder.children || [];
    folder.children.push(item);

    this.storage.saveData();
    this.renderCallback();
    toast(`Added to "${folder.title}" ✓`, 'success');
  }
}
