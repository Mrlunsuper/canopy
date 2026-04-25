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
          resolve(result[WALLPAPER_KEY] || null);
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
    } else {
      localStorage.setItem(WALLPAPER_KEY, wp);
    }
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
}
