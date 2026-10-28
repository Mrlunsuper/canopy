/* ============================================================
   CANOPY — js/StorageManager.js
   Encapsulates Chrome storage / localStorage persistence
   ============================================================ */

import { STORAGE_KEY, WALLPAPER_KEY, toast } from './utils.js';
import './storage-sync.js';

const { clone, merge, update } = globalThis.CanopyPersistence;

export class StorageManager {
  constructor() {
    /** @type {{ items: Array }} */
    this.data = { items: [] };
    this._baseline = clone(this.data);
    this._saveQueue = Promise.resolve(true);
  }

  // ─── Data ────────────────────────────────────

  /**
   * Load desktop data from storage.
   * @returns {Promise<{ items: Array }>}
   */
  async loadData() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STORAGE_KEY], result => {
          if (result[STORAGE_KEY]) {
            this.data = result[STORAGE_KEY];
          }
          this._baseline = clone(this.data);
          resolve(this.data);
        });
      } else {
        // fallback for testing outside extension
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) this.data = JSON.parse(raw);
        } catch { /* ignore */ }
        this._baseline = clone(this.data);
        resolve(this.data);
      }
    });
  }

  acceptExternal(data) {
    if (!data || !Array.isArray(data.items)) return;
    this.data = merge(this._baseline, this.data, data);
    this._baseline = clone(data);
  }

  async flush() {
    return this._saveQueue;
  }

  /**
   * Persist current desktop data.
   */
  saveData() {
    const snapshot = clone(this.data);
    const base = clone(this._baseline);
    // Capture changes now, not after an asynchronous write has completed.
    this._baseline = clone(snapshot);
    const operation = this._saveQueue.then(async () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const saved = await update(STORAGE_KEY, base, snapshot);
        this.data = merge(snapshot, this.data, saved);
        this._baseline = merge(snapshot, this._baseline, saved);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      }
      return true;
    });
    this._saveQueue = operation.catch(error => {
      console.error('Desktop save failed:', error);
      // Restore the baseline so a subsequent edit retries unsaved changes.
      this._baseline = base;
      toast('Changes not saved. Check available storage and try again.', 'error');
      return false;
    });
    return this._saveQueue;
  }

  // ─── Wallpaper ───────────────────────────────

  /**
   * Load saved wallpaper preference.
   * @returns {Promise<string|null>}
   */
  async loadWallpaper() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([WALLPAPER_KEY], result => {
          const wp = result[WALLPAPER_KEY] || null;
          if (wp) try { localStorage.setItem(WALLPAPER_KEY, wp); } catch (e) {}
          resolve(wp);
        });
      } else {
        resolve(localStorage.getItem(WALLPAPER_KEY) || null);
      }
    });
  }

  /**
   * Persist wallpaper preference.
   * @param {string} wp
   */
  saveWallpaper(wp) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [WALLPAPER_KEY]: wp }, () => {
        if (chrome.runtime?.lastError) {
          console.error('Wallpaper save failed:', chrome.runtime.lastError.message);
          toast('Wallpaper not saved. Storage is full.', 'error');
        }
      });
    }
    try { localStorage.setItem(WALLPAPER_KEY, wp); } catch (e) { /* quota — keep chrome copy */ }
  }

  // ─── Helpers ─────────────────────────────────

  /**
   * Recursively find an item by ID.
   * @param {string} id
   * @param {Array} [list]
   * @returns {object|null}
   */
  findItem(id, list = this.data.items) {
    for (const item of list) {
      if (item.id === id) return item;
      if (item.children?.length) {
        const found = this.findItem(id, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Recursively find the array that contains the item with the given ID.
   * @param {string} id
   * @param {Array} [list]
   * @returns {Array|null}
   */
  findParentList(id, list = this.data.items) {
    for (const item of list) {
      if (item.id === id) return list;
      if (item.children?.length) {
        const foundList = this.findParentList(id, item.children);
        if (foundList) return foundList;
      }
    }
    return null;
  }

  /**
   * Recursively find the folder that owns a child list.
   * @param {Array} targetList
   * @param {Array} [list]
   * @returns {object|null}
   */
  findFolderContainingList(targetList, list = this.data.items) {
    for (const item of list) {
      if (item.children === targetList) return item;
      if (item.children?.length) {
        const found = this.findFolderContainingList(targetList, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Remove the folder that owns this list if it is now empty.
   * @param {Array|null} list
   * @returns {object|null} The removed folder
   */
  removeEmptyFolderForList(list) {
    if (!list || list === this.data.items || list.length > 0) return null;

    const folder = this.findFolderContainingList(list);
    if (!folder) return null;

    const folderParentList = this.findParentList(folder.id);
    const removed = this.removeItem(folder.id);

    if (folderParentList && folderParentList !== this.data.items && folderParentList.length === 0) {
      this.removeEmptyFolderForList(folderParentList);
    }

    return removed;
  }

  /**
   * Remove an item by ID from wherever it is (desktop or inside a folder).
   * @param {string} id
   * @returns {object|null} The removed item
   */
  removeItem(id) {
    const list = this.findParentList(id);
    if (list) {
      const idx = list.findIndex(i => i.id === id);
      if (idx !== -1) {
        const [removed] = list.splice(idx, 1);
        return removed;
      }
    }
    return null;
  }

  /**
   * Find an item by URL anywhere (desktop + nested folders).
   * @param {string} url — normalized URL
   * @param {string|null} [excludeId] — skip this ID (for edit flow)
   * @returns {object|null}
   */
  findItemByUrl(url, excludeId = null, list = this.data.items) {
    for (const item of list) {
      if (item.id !== excludeId && item.url === url) return item;
      if (item.children?.length) {
        const found = this.findItemByUrl(url, excludeId, item.children);
        if (found) return found;
      }
    }
    return null;
  }
}
