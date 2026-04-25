/* ============================================================
   CANOPY — js/ContextMenuManager.js
   Right-click context menu and arrange submenu
   ============================================================ */

export class ContextMenuManager {
  /**
   * @param {import('./DesktopRenderer.js').DesktopRenderer} renderer
   */
  constructor(renderer) {
    this.renderer = renderer;

    /** @type {object|null} Item being right-clicked */
    this.contextTarget   = null;

    /** @type {{x:number,y:number}|null} Grid-snapped position for new items */
    this.pendingPosition = null;

    this.menuEl    = document.getElementById('context-menu');
    this.arrangeEl = document.getElementById('arrange-menu');
  }

  // ─── Context Menu ────────────────────────────

  /**
   * Show the context menu at the given coordinates.
   * @param {number} x
   * @param {number} y
   * @param {object|null} item — the item that was right-clicked (null for desktop background)
   */
  show(x, y, item = null) {
    this.contextTarget = item;

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

    this.menuEl.classList.remove('hidden');
    this.menuEl.style.left = x + 'px';
    this.menuEl.style.top  = y + 'px';

    // keep within viewport
    requestAnimationFrame(() => {
      const mr = this.menuEl.getBoundingClientRect();
      if (mr.right  > window.innerWidth)  this.menuEl.style.left = (x - mr.width)  + 'px';
      if (mr.bottom > window.innerHeight) this.menuEl.style.top  = (y - mr.height) + 'px';
    });
  }

  /**
   * Hide the context menu.
   */
  hide() {
    this.menuEl.classList.add('hidden');
    this.contextTarget = null;
  }

  // ─── Arrange Submenu ─────────────────────────

  /**
   * Show the arrange submenu.
   * @param {number} x
   * @param {number} y
   */
  showArrangeMenu(x, y) {
    this.arrangeEl.classList.remove('hidden');
    this.arrangeEl.style.left = x + 'px';
    this.arrangeEl.style.top  = y + 'px';

    // keep within viewport
    requestAnimationFrame(() => {
      const mr = this.arrangeEl.getBoundingClientRect();
      if (mr.right  > window.innerWidth)  this.arrangeEl.style.left = (x - mr.width)  + 'px';
      if (mr.bottom > window.innerHeight) this.arrangeEl.style.top  = (y - mr.height) + 'px';
    });
  }

  /**
   * Hide the arrange submenu.
   */
  hideArrangeMenu() {
    this.arrangeEl.classList.add('hidden');
  }
}
