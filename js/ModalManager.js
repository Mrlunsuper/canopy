/* ============================================================
   CANOPY — js/ModalManager.js
   Shortcut modal, folder-create modal, and folder overlay
   ============================================================ */

import { uid, getFaviconUrl, toast } from './utils.js';

export class ModalManager {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   * @param {import('./DesktopRenderer.js').DesktopRenderer} renderer
   */
  constructor(storage, renderer) {
    this.storage  = storage;
    this.renderer = renderer;

    // ── State ──
    this.editingItemId   = null;
    this.editingFolderId = null;
    this.pendingPosition = null;
    this.selectedEmoji   = 'folder';
    this.openFolderId    = null;
  }

  // ═══════════════════════════════════════════════
  //  COMMON
  // ═══════════════════════════════════════════════

  /**
   * Close a modal with animation, then hide it.
   * @param {string} id
   */
  closeModal(id) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains('hidden') || el.classList.contains('closing')) return;

    el.classList.add('closing');
    el.addEventListener('animationend', () => {
      el.classList.remove('closing');
      el.classList.add('hidden');
    }, { once: true });
  }

  // ═══════════════════════════════════════════════
  //  SHORTCUT MODAL
  // ═══════════════════════════════════════════════

  /**
   * Open the shortcut add/edit modal.
   * @param {object|null} item — existing item to edit
   * @param {{x:number,y:number}|null} pos — position for new item
   */
  openShortcutModal(item = null, pos = null) {
    this.editingItemId  = item ? item.id : null;
    this.pendingPosition = pos;

    document.getElementById('shortcut-modal-title').textContent = item ? 'Edit Shortcut' : 'Add Shortcut';
    document.getElementById('sc-url').value  = item?.url  || '';
    document.getElementById('sc-name').value = item?.title || '';
    document.getElementById('sc-icon').value = item?.icon  || '';
    document.getElementById('sc-icon-preview').innerHTML = '';

    if (item?.icon) {
      this._previewScIcon(item.icon);
    } else if (item?.url) {
      this._previewScIcon(getFaviconUrl(item.url));
    }

    document.getElementById('shortcut-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('sc-url').focus(), 50);
  }

  /**
   * Preview shortcut icon in the modal.
   * @param {string} src
   * @private
   */
  _previewScIcon(src) {
    if (!src) return;
    const preview = document.getElementById('sc-icon-preview');
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'icon preview';
    img.onerror = () => {
      preview.innerHTML = '<span style="color:var(--text-muted);font-size:12px">Failed to load icon</span>';
    };
    preview.appendChild(img);
  }

  /**
   * Save a shortcut from the modal form.
   */
  saveShortcut() {
    const url   = document.getElementById('sc-url').value.trim();
    const title = document.getElementById('sc-name').value.trim();
    const icon  = document.getElementById('sc-icon').value.trim();

    if (!url) { toast('Please enter URL', 'error'); return; }

    // auto-add protocol
    const finalUrl   = url.match(/^https?:\/\//i) ? url : 'https://' + url;
    const finalTitle = title || new URL(finalUrl).hostname.replace('www.', '');

    if (this.editingItemId) {
      const item = this.storage.findItem(this.editingItemId);
      if (item) {
        item.url   = finalUrl;
        item.title = finalTitle;
        item.icon  = icon || null;
      }
      this.storage.saveData();
      this.renderer.render();
      toast('Shortcut updated ✓', 'success');
    } else {
      this.renderer.addShortcut({
        url:      finalUrl,
        title:    finalTitle,
        icon:     icon || null,
        position: this.pendingPosition,
      });
      toast('Shortcut added ✓', 'success');
    }

    this.closeModal('shortcut-modal');
  }

  // ─── Shortcut-to-folder ─────────────────────

  /**
   * Open the shortcut modal in "add to folder" context.
   * @param {string} folderId
   */
  openShortcutModalForFolder(folderId) {
    this.editingItemId   = null;
    this.editingFolderId = folderId;
    this.pendingPosition = null;

    document.getElementById('shortcut-modal-title').textContent = 'Add Shortcut to Folder';
    document.getElementById('sc-url').value  = '';
    document.getElementById('sc-name').value = '';
    document.getElementById('sc-icon').value = '';
    document.getElementById('sc-icon-preview').innerHTML = '';
    document.getElementById('shortcut-modal').classList.remove('hidden');
  }

  /**
   * Save a shortcut directly into a folder.
   */
  saveShortcutToFolder() {
    const url   = document.getElementById('sc-url').value.trim();
    const title = document.getElementById('sc-name').value.trim();
    const icon  = document.getElementById('sc-icon').value.trim();

    const finalUrl   = url.match(/^https?:\/\//i) ? url : 'https://' + url;
    const finalTitle = title || new URL(finalUrl).hostname.replace('www.', '');

    const folder = this.storage.findItem(this.editingFolderId);
    if (folder) {
      folder.children = folder.children || [];
      folder.children.push({
        id:       uid(),
        type:     'shortcut',
        title:    finalTitle,
        url:      finalUrl,
        icon:     icon || null,
        children: [],
      });
      this.storage.saveData();
      this.renderer.render();
      toast('Added to folder ✓', 'success');
      this.closeModal('shortcut-modal');
      setTimeout(() => this.openFolderOverlay(folder), 100);
    }
  }

  // ═══════════════════════════════════════════════
  //  FOLDER CREATE MODAL
  // ═══════════════════════════════════════════════

  /**
   * Open the folder create/edit modal.
   * @param {object|null} item
   * @param {{x:number,y:number}|null} pos
   */
  openFolderCreateModal(item = null, pos = null) {
    this.editingFolderId = item ? item.id : null;
    this.pendingPosition = pos;
    this.selectedEmoji   = item?.emoji || 'folder';

    document.getElementById('folder-modal-create-title').textContent = item ? 'Edit Folder' : 'Create Folder';
    document.getElementById('folder-name').value = item?.title || '';

    // reset emoji selection
    document.querySelectorAll('.emoji-opt').forEach(el => {
      el.classList.toggle('selected', el.dataset.emoji === this.selectedEmoji);
    });

    document.getElementById('folder-modal-create').classList.remove('hidden');
    setTimeout(() => document.getElementById('folder-name').focus(), 50);
  }

  /**
   * Save folder from the modal form.
   */
  saveFolder() {
    const name = document.getElementById('folder-name').value.trim() || 'New Folder';

    if (this.editingFolderId) {
      const item = this.storage.findItem(this.editingFolderId);
      if (item) {
        item.title = name;
        item.emoji = this.selectedEmoji;
      }
      this.storage.saveData();
      this.renderer.render();
      toast('Folder updated ✓', 'success');
    } else {
      this.renderer.addFolder({
        title:    name,
        emoji:    this.selectedEmoji,
        position: this.pendingPosition,
      });
      toast('Folder created ✓', 'success');
    }

    this.closeModal('folder-modal-create');
  }

  // ═══════════════════════════════════════════════
  //  FOLDER OVERLAY
  // ═══════════════════════════════════════════════

  /**
   * Open a folder's content overlay.
   * @param {object} item
   */
  openFolderOverlay(item) {
    this.openFolderId = item.id;
    const iconName = item.emoji || 'folder';

    // build title
    const titleIcon = document.createElement('i');
    titleIcon.dataset.lucide = iconName;
    titleIcon.style.cssText  = 'width:16px;height:16px;vertical-align:middle;margin-right:6px';
    const titleEl = document.getElementById('folder-modal-title');
    titleEl.innerHTML = '';
    titleEl.appendChild(titleIcon);
    titleEl.appendChild(document.createTextNode(item.title));
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [titleEl] });

    // build grid
    const grid = document.getElementById('folder-modal-grid');
    grid.innerHTML = '';

    (item.children || []).forEach(child => {
      const el = this.renderer.createIconElement(child, true);
      el.style.position = 'static';
      // In-folder click → open
      el.addEventListener('dblclick', () => this._openItem(child));
      grid.appendChild(el);
    });

    // add button inside folder
    const addBtn = document.createElement('div');
    addBtn.className = 'desktop-icon add-in-folder';
    addBtn.style.position = 'static';
    addBtn.innerHTML = `
      <div class="icon-img-wrap" style="opacity:0.4">
        <i data-lucide="plus" style="width:38px;height:38px"></i>
      </div>
      <span class="icon-label" style="opacity:0.4">Add</span>`;
    addBtn.addEventListener('click', () => {
      this.closeModal('folder-overlay');
      this.openShortcutModalForFolder(item.id);
    });
    grid.appendChild(addBtn);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });

    document.getElementById('folder-overlay').classList.remove('hidden');
  }

  /**
   * Open an item (shortcut navigates, folder opens overlay).
   * @param {object} item
   * @private
   */
  _openItem(item) {
    if (item.type === 'folder') {
      this.openFolderOverlay(item);
    } else if (item.url) {
      window.location.href = item.url;
    }
  }

  // ═══════════════════════════════════════════════
  //  EVENT WIRING
  // ═══════════════════════════════════════════════

  /**
   * Wire up all modal-related DOM events.
   */
  wireEvents() {
    // ── Shortcut modal inputs ──
    document.getElementById('sc-url').addEventListener('input', e => {
      const url = e.target.value.trim();
      if (url && !document.getElementById('sc-name').value) {
        try {
          document.getElementById('sc-name').value = new URL(url.match(/^https?:\/\//i) ? url : 'https://' + url).hostname.replace('www.', '');
        } catch { /* ignore */ }
      }
      if (url) this._previewScIcon(getFaviconUrl(url.match(/^https?:\/\//i) ? url : 'https://' + url));
    });

    document.getElementById('sc-icon').addEventListener('input', e => {
      this._previewScIcon(e.target.value.trim());
    });

    document.getElementById('sc-save').addEventListener('click', () => {
      // Determine context: adding to folder or desktop
      if (document.getElementById('shortcut-modal-title').textContent.includes('Folder')) {
        this.saveShortcutToFolder();
      } else {
        this.saveShortcut();
      }
    });

    document.getElementById('sc-cancel').addEventListener('click', () => this.closeModal('shortcut-modal'));

    document.getElementById('sc-url').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('sc-save').click();
    });

    // ── Folder create modal ──
    document.querySelectorAll('.emoji-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        this.selectedEmoji = el.dataset.emoji;
      });
    });

    document.getElementById('folder-save').addEventListener('click', () => this.saveFolder());
    document.getElementById('folder-cancel').addEventListener('click', () => this.closeModal('folder-modal-create'));

    document.getElementById('folder-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('folder-save').click();
    });

    // ── Folder overlay ──
    document.getElementById('folder-modal-close').addEventListener('click', () => this.closeModal('folder-overlay'));
    document.getElementById('folder-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('folder-overlay')) this.closeModal('folder-overlay');
    });

    // ── Modal close buttons ──
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
    });
  }
}
