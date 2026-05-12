/* ============================================================
   CANOPY — js/DragDropManager.js
   Drag & drop state and event handling
   ============================================================ */

import { GRID_COL, GRID_ROW, uid, snapToGrid, toast } from './utils.js';

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

    setTimeout(() => {
      el.classList.add('dragging');
      document.getElementById('trash-zone').classList.remove('hidden');
    }, 0);
  }

  /**
   * Handle dragend on a desktop icon.
   * @param {DragEvent} e
   */
  onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.getElementById('trash-zone').classList.add('hidden');
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

    // ── Trash Zone ──
    const trash = document.getElementById('trash-zone');
    trash.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      trash.classList.add('drag-over');
    });
    trash.addEventListener('dragleave', () => {
      trash.classList.remove('drag-over');
    });
    trash.addEventListener('drop', e => {
      e.preventDefault();
      trash.classList.remove('drag-over');
      if (this._dragId) {
        const removed = this.storage.removeItem(this._dragId);
        if (removed) {
          this.storage.saveData();
          this.renderCallback();
          toast(`Deleted "${removed.title}"`, 'info');
        }
        this._dragId = null;
      }
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

  /**
   * Create a new folder by dropping one item onto another.
   * @param {string} dragId
   * @param {string} targetId
   */
  createFolderFromItems(dragId, targetId) {
    const data = this.storage.data;
    const dragIdx = data.items.findIndex(i => i.id === dragId);
    const targetIdx = data.items.findIndex(i => i.id === targetId);
    
    if (dragIdx === -1 || targetIdx === -1) return;

    const dragItem = data.items[dragIdx];
    const targetItem = data.items[targetIdx];

    // Remove both items from desktop
    // Remember to remove the higher index first to avoid shifting issues
    if (dragIdx > targetIdx) {
      data.items.splice(dragIdx, 1);
      data.items.splice(targetIdx, 1);
    } else {
      data.items.splice(targetIdx, 1);
      data.items.splice(dragIdx, 1);
    }

    // Create new folder
    const newFolder = {
      id:       uid(),
      type:     'folder',
      title:    'New Folder',
      emoji:    'folder',
      url:      null,
      icon:     null,
      position: { ...targetItem.position }, // take position of the target item
      children: [targetItem, dragItem]      // target item first, then dragged item
    };

    data.items.push(newFolder);
    this.storage.saveData();
    this.renderCallback();
    toast('Created new folder ✓', 'success');
  }
}
