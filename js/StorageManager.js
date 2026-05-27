/* ============================================================
   CANOPY — js/StorageManager.js
   Encapsulates Chrome storage / localStorage persistence
   ============================================================ */

import { STORAGE_KEY, WALLPAPER_KEY } from './utils.js';

export class StorageManager {
  constructor() {
    /** @type {{ items: Array }} */
    this.data = { items: [] };
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
          resolve(this.data);
        });
      } else {
        // fallback for testing outside extension
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) this.data = JSON.parse(raw);
        } catch { /* ignore */ }
        resolve(this.data);
      }
    });
  }

  /**
   * Persist current desktop data.
   */
  saveData() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: this.data });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }
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
      chrome.storage.local.set({ [WALLPAPER_KEY]: wp });
    }
    try { localStorage.setItem(WALLPAPER_KEY, wp); } catch (e) {}
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
}
