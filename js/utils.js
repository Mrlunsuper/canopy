/* ============================================================
   CANOPY — js/utils.js
   Constants & pure utility functions
   ============================================================ */

'use strict';

// ═══════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════

export const STORAGE_KEY    = 'desktop_tab_data';
export const WALLPAPER_KEY  = 'desktop_tab_wallpaper';
export const GRID_COL       = 130;   // px width of each icon cell
export const GRID_ROW       = 116;   // px height of each icon cell

export const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

// ═══════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════

/**
 * Generate a short unique ID.
 * @returns {string}
 */
export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Build a Google Favicon URL for the given page URL.
 * @param {string} url
 * @returns {string|null}
 */
export function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}

/**
 * Snap x/y coordinates to the nearest grid position.
 * @param {number} x
 * @param {number} y
 * @returns {{x: number, y: number}}
 */
export function snapToGrid(x, y) {
  return {
    x: Math.max(0, Math.round(x / GRID_COL) * GRID_COL),
    y: Math.max(0, Math.round(y / GRID_ROW) * GRID_ROW),
  };
}

/**
 * Show a toast notification.
 * @param {string} msg
 * @param {'info'|'success'|'error'} type
 */
export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/**
 * Pad a number with a leading zero.
 * @param {number} n
 * @returns {string}
 */
export function pad2(n) {
  return String(n).padStart(2, '0');
}
