/* ============================================================
   CANOPY — js/FaviconCache.js
   LRU favicon cache backed by chrome.storage.local
   ============================================================ */

'use strict';

import { FAVICON_CACHE_KEY } from './utils.js';

const MAX_ENTRIES = 100;

export class FaviconCache {
  constructor() {
    this._cache = {};
    this._order = [];
  }

  /**
   * Load cache from chrome.storage.local.
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([FAVICON_CACHE_KEY], result => {
          const saved = result[FAVICON_CACHE_KEY];
          if (saved && typeof saved === 'object') {
            this._cache = saved.entries || {};
            this._order = saved.order || Object.keys(this._cache);
          }
          resolve();
        });
      } else {
        try {
          const raw = localStorage.getItem(FAVICON_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            this._cache = parsed.entries || {};
            this._order = parsed.order || Object.keys(this._cache);
          }
        } catch { /* ignore */ }
        resolve();
      }
    });
  }

  /**
   * Get a cached favicon data URL for a domain.
   * @param {string} domain
   * @returns {string|null}
   */
  get(domain) {
    if (this._cache[domain]) {
      this._touch(domain);
      return this._cache[domain];
    }
    return null;
  }

  /**
   * Store a favicon data URL for a domain and persist.
   * @param {string} domain
   * @param {string} dataUrl
   */
  set(domain, dataUrl) {
    if (!domain || !dataUrl) return;

    this._cache[domain] = dataUrl;
    this._touch(domain);

    if (this._order.length > MAX_ENTRIES) {
      const oldest = this._order.shift();
      delete this._cache[oldest];
    }

    this._persist();
  }

  /**
   * Fetch a favicon from Google's service, cache it, and return the data URL.
   * Falls back to the remote URL if fetch fails.
   * @param {string} url — full page URL
   * @returns {string} data URL or remote favicon URL
   */
  async resolve(url) {
    let domain;
    try {
      domain = new URL(url).hostname;
    } catch {
      return null;
    }

    const cached = this.get(domain);
    if (cached) return cached;

    const remoteUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    try {
      const resp = await fetch(remoteUrl);
      if (!resp.ok || resp.status === 404) return remoteUrl;

      const blob = await resp.blob();
      if (!blob.type.startsWith('image/')) return remoteUrl;

      const dataUrl = await this._blobToDataUrl(blob);
      if (dataUrl) {
        this.set(domain, dataUrl);
        return dataUrl;
      }
    } catch { /* network error — fall through */ }

    return remoteUrl;
  }

  /** @private */
  _touch(domain) {
    const idx = this._order.indexOf(domain);
    if (idx !== -1) this._order.splice(idx, 1);
    this._order.push(domain);
  }

  /** @private */
  _persist() {
    const payload = { entries: this._cache, order: this._order };
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [FAVICON_CACHE_KEY]: payload });
    } else {
      try { localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(payload)); } catch { /* quota */ }
    }
  }

  /** @private */
  _blobToDataUrl(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
}
