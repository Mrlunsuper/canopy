/* ============================================================
   CANOPY — js/BookmarkImporter.js
   Chrome bookmark import functionality
   ============================================================ */

import { uid, getFaviconUrl, toast } from './utils.js';

export class BookmarkImporter {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   * @param {import('./DesktopRenderer.js').DesktopRenderer} renderer
   * @param {Function} closeModal — function(id) to close a modal
   */
  constructor(storage, renderer, closeModal) {
    this.storage    = storage;
    this.renderer   = renderer;
    this.closeModal = closeModal;
  }

  // ─── Open ────────────────────────────────────

  /**
   * Open the bookmark import modal.
   */
  openImportModal() {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) {
      toast('chrome.bookmarks API is not available outside extension', 'error');
      return;
    }

    chrome.bookmarks.getTree(tree => {
      const container = document.getElementById('bookmark-tree');
      container.innerHTML = '';
      this._renderTree(tree, container, 0);
      document.getElementById('import-modal').classList.remove('hidden');
    });
  }

  // ─── Tree Rendering ──────────────────────────

  /**
   * Recursively render the bookmark tree.
   * @param {Array} nodes
   * @param {HTMLElement} container
   * @param {number} depth
   * @private
   */
  _renderTree(nodes, container, depth) {
    nodes.forEach(node => {
      if (node.children) {
        // it's a folder
        if (depth <= 1 && node.title === '') {
          // root nodes — just render children
          this._renderTree(node.children, container, depth + 1);
          return;
        }

        const folderEl = document.createElement('div');
        folderEl.className = 'bm-folder';

        const header = document.createElement('div');
        header.className = 'bm-folder-header';

        const toggle = document.createElement('span');
        toggle.className = 'bm-toggle';
        toggle.textContent = '▶';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.bmId = node.id;
        checkbox.dataset.bmType = 'folder';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = '📁 ' + (node.title || 'Folder');

        header.appendChild(toggle);
        header.appendChild(checkbox);
        header.appendChild(nameSpan);

        const childContainer = document.createElement('div');
        childContainer.className = 'bm-children';

        header.addEventListener('click', e => {
          if (e.target === checkbox) return;
          childContainer.classList.toggle('open');
          toggle.classList.toggle('open');
        });

        // folder checkbox selects all children
        checkbox.addEventListener('change', () => {
          childContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = checkbox.checked;
          });
        });

        folderEl.appendChild(header);
        this._renderTree(node.children, childContainer, depth + 1);
        folderEl.appendChild(childContainer);
        container.appendChild(folderEl);

      } else if (node.url) {
        // it's a bookmark
        const item = document.createElement('div');
        item.className = 'bm-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.bmId    = node.id;
        checkbox.dataset.bmUrl   = node.url;
        checkbox.dataset.bmTitle = node.title || node.url;

        const img = document.createElement('img');
        img.src = getFaviconUrl(node.url) || '';
        img.alt = '';
        img.onerror = () => { img.style.display = 'none'; };

        const label = document.createElement('span');
        label.textContent = node.title || node.url;
        label.title = node.url;

        item.appendChild(checkbox);
        item.appendChild(img);
        item.appendChild(label);

        item.addEventListener('click', e => {
          if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        });

        container.appendChild(item);
      }
    });
  }

  // ─── Import ──────────────────────────────────

  /**
   * Import all checked bookmarks to the desktop.
   */
  importSelected() {
    const checked = document.querySelectorAll('#bookmark-tree input[type="checkbox"]:checked[data-bm-url]');
    if (checked.length === 0) {
      toast('No bookmarks selected', 'error');
      return;
    }

    let added = 0;
    checked.forEach(cb => {
      const url   = cb.dataset.bmUrl;
      const title = cb.dataset.bmTitle;
      // skip duplicates
      if (this.storage.data.items.some(i => i.url === url)) return;
      const pos = this.renderer.findFreePosition();
      this.storage.data.items.push({
        id:       uid(),
        type:     'shortcut',
        title:    title,
        url:      url,
        icon:     null,
        position: pos,
        children: [],
      });
      added++;
    });

    this.storage.saveData();
    this.renderer.render();
    this.closeModal('import-modal');
    toast(`Imported ${added} bookmark(s) ✓`, 'success');
  }

  /**
   * Select or deselect all bookmarks.
   * @param {boolean} state
   */
  selectAll(state) {
    document.querySelectorAll('#bookmark-tree input[type="checkbox"]').forEach(cb => {
      cb.checked = state;
    });
  }

  // ─── Event Wiring ───────────────────────────

  /**
   * Wire up import modal DOM events.
   */
  wireEvents() {
    document.getElementById('import-cancel').addEventListener('click', () => this.closeModal('import-modal'));
    document.getElementById('import-confirm').addEventListener('click', () => this.importSelected());

    document.getElementById('import-select-all').addEventListener('click', () => {
      const allChecked = [...document.querySelectorAll('#bookmark-tree input[type="checkbox"]')].every(cb => cb.checked);
      this.selectAll(!allChecked);
      document.getElementById('import-select-all').textContent = allChecked ? 'Select all' : 'Deselect all';
    });

    document.getElementById('import-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('import-modal')) this.closeModal('import-modal');
    });
  }
}
