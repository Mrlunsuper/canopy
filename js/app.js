/* ============================================================
   CANOPY — js/app.js
   Application orchestrator — wires all modules together
   ============================================================ */

import { snapToGrid, toast } from './utils.js';
import { StorageManager }     from './StorageManager.js';
import { WallpaperManager }   from './WallpaperManager.js';
import { DesktopRenderer }    from './DesktopRenderer.js';
import { DragDropManager }    from './DragDropManager.js';
import { ContextMenuManager } from './ContextMenuManager.js';
import { ModalManager }       from './ModalManager.js';
import { BookmarkImporter }   from './BookmarkImporter.js';
import { ClockWidget }        from './ClockWidget.js';
import { SearchBar }          from './SearchBar.js';

class CanopyApp {
  constructor() {
    // ── Data layer ──
    this.storage   = new StorageManager();
    this.wallpaper = new WallpaperManager(this.storage);

    // ── Drag & drop (needs render callback — set after renderer) ──
    this.dragDrop = new DragDropManager(
      this.storage,
      () => this.renderer.render()
    );

    // ── Desktop renderer ──
    this.renderer = new DesktopRenderer(
      this.storage,
      this.dragDrop,
      item => this._openItem(item),          // onIconOpen
      (x, y, item) => this._onIconContext(x, y, item)  // onIconContext
    );

    // ── Context menus ──
    this.contextMenu = new ContextMenuManager(this.renderer);

    // ── Modals ──
    this.modals = new ModalManager(this.storage, this.renderer);

    // ── Bookmark importer ──
    this.bookmarks = new BookmarkImporter(
      this.storage,
      this.renderer,
      id => this.modals.closeModal(id)
    );

    // ── Widgets ──
    this.clock  = new ClockWidget();
    this.search = new SearchBar();
  }

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════

  async init() {
    // Load data
    await this.storage.loadData();

    // Load and apply wallpaper
    const wp = await this.storage.loadWallpaper();
    if (wp) this.wallpaper.apply(wp);

    // Render desktop
    this.renderer.render();

    // Start clock
    this.clock.startTicking();

    // Initialize drop zone
    this.dragDrop.initDropZone();

    // Wire all events
    this._wireEvents();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ═══════════════════════════════════════════════
  //  ITEM OPEN HANDLER
  // ═══════════════════════════════════════════════

  /**
   * Open a desktop item (shortcut → navigate, folder → overlay).
   * @param {object} item
   * @private
   */
  _openItem(item) {
    if (item.type === 'folder') {
      this.modals.openFolderOverlay(item);
    } else if (item.url) {
      window.location.href = item.url;
    }
  }

  /**
   * Handle right-click on an icon.
   * @private
   */
  _onIconContext(x, y, item) {
    this.contextMenu.show(x, y, item);
  }

  // ═══════════════════════════════════════════════
  //  SETTINGS (Export / Import / Reset)
  // ═══════════════════════════════════════════════

  /** @private */
  _exportData() {
    const json = JSON.stringify(this.storage.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'desktop-tab-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported ✓', 'success');
  }

  /** @private */
  _importDataFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        this.storage.data = JSON.parse(e.target.result);
        this.storage.saveData();
        this.renderer.render();
        toast('Data imported ✓', 'success');
      } catch {
        toast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  /** @private */
  _resetData() {
    if (!confirm('Are you sure you want to delete all data? This action cannot be undone.')) return;
    this.storage.data = { items: [] };
    this.storage.saveData();
    this.renderer.render();
    toast('All data deleted', 'info');
  }

  /**
   * Close the settings panel with slide-out animation.
   * @private
   */
  _closeSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (panel.classList.contains('hidden') || panel.classList.contains('closing')) return;

    panel.classList.add('closing');
    panel.addEventListener('animationend', () => {
      panel.classList.remove('closing');
      panel.classList.add('hidden');
    }, { once: true });
  }

  // ═══════════════════════════════════════════════
  //  EVENT WIRING
  // ═══════════════════════════════════════════════

  /** @private */
  _wireEvents() {
    // Wire sub-module events
    this.modals.wireEvents();
    this.bookmarks.wireEvents();
    this.search.wireEvents();

    // ── Desktop background click ──
    document.getElementById('desktop').addEventListener('click', e => {
      if (e.target === document.getElementById('desktop') ||
          e.target === document.getElementById('desktop-grid')) {
        this.renderer.clearSelection();
        this.contextMenu.hide();
      }
    });

    // ── Desktop right-click ──
    document.getElementById('desktop-grid').addEventListener('contextmenu', e => {
      if (e.target === document.getElementById('desktop-grid')) {
        e.preventDefault();
        this.renderer.clearSelection();
        // store cursor position for new items
        const rect = document.getElementById('desktop-grid').getBoundingClientRect();
        const snapped = snapToGrid(e.clientX - rect.left, e.clientY - rect.top);
        this.contextMenu.pendingPosition = snapped;
        this.contextMenu.show(e.clientX, e.clientY, null);
      }
    });

    // ── Context menu items ──
    document.getElementById('ctx-add-shortcut').addEventListener('click', () => {
      this.contextMenu.hide();
      this.modals.openShortcutModal(null, this.contextMenu.pendingPosition);
    });

    document.getElementById('ctx-add-folder').addEventListener('click', () => {
      this.contextMenu.hide();
      this.modals.openFolderCreateModal(null, this.contextMenu.pendingPosition);
    });

    document.getElementById('ctx-edit').addEventListener('click', () => {
      const item = this.contextMenu.contextTarget;
      this.contextMenu.hide();
      if (!item) return;
      if (item.type === 'folder') {
        this.modals.openFolderCreateModal(item);
      } else {
        this.modals.openShortcutModal(item);
      }
    });

    document.getElementById('ctx-delete').addEventListener('click', () => {
      const item = this.contextMenu.contextTarget;
      this.contextMenu.hide();
      if (item) this.renderer.deleteItem(item.id);
    });

    document.getElementById('ctx-arrange').addEventListener('click', e => {
      e.stopPropagation();
      const rect = document.getElementById('ctx-arrange').getBoundingClientRect();
      this.contextMenu.hide();
      this.contextMenu.showArrangeMenu(rect.right + 4, rect.top);
    });

    // ── Arrange submenu items ──
    document.querySelectorAll('.arr-item').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.contextMenu.hideArrangeMenu();
        this.renderer.autoArrange(el.dataset.sort, el.dataset.dir);
      });
    });

    document.getElementById('ctx-wallpaper').addEventListener('click', () => {
      this.contextMenu.hide();
      document.getElementById('settings-panel').classList.remove('hidden');
    });

    // Hide context menu and arrange menu on click elsewhere
    document.addEventListener('click', () => {
      this.contextMenu.hide();
      this.contextMenu.hideArrangeMenu();
    });

    // ── Taskbar buttons ──
    document.getElementById('btn-import').addEventListener('click', () => this.bookmarks.openImportModal());

    document.getElementById('btn-settings').addEventListener('click', e => {
      e.stopPropagation();
      const panel = document.getElementById('settings-panel');
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
      } else {
        this._closeSettingsPanel();
      }
    });

    document.getElementById('settings-close').addEventListener('click', () => {
      this._closeSettingsPanel();
    });

    // Close settings by clicking outside the panel
    document.getElementById('desktop').addEventListener('click', e => {
      const panel = document.getElementById('settings-panel');
      if (!panel.classList.contains('hidden') && !panel.contains(e.target)) {
        this._closeSettingsPanel();
      }
    });

    // ── Wallpaper presets ──
    document.querySelectorAll('.wp-preset').forEach(el => {
      el.addEventListener('click', () => {
        this.wallpaper.set(el.dataset.wp);
      });
    });

    // ── Wallpaper upload ──
    document.getElementById('wallpaper-upload').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        this.wallpaper.set(ev.target.result);
      };
      reader.readAsDataURL(file);
    });

    // ── Settings data ──
    document.getElementById('btn-export-data').addEventListener('click', () => this._exportData());
    document.getElementById('import-data-file').addEventListener('change', e => this._importDataFromFile(e.target.files[0]));
    document.getElementById('btn-reset-data').addEventListener('click', () => this._resetData());

    // ── Keyboard shortcuts ──
    this._wireKeyboardShortcuts();
  }

  /** @private */
  _wireKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['shortcut-modal', 'folder-modal-create', 'import-modal', 'folder-overlay'].forEach(id => {
          if (!document.getElementById(id).classList.contains('hidden')) {
            this.modals.closeModal(id);
          }
        });
        this._closeSettingsPanel();
        this.contextMenu.hide();
        this.contextMenu.hideArrangeMenu();
        this.renderer.clearSelection();
      }
      if (e.key === 'Delete' && this.renderer.selectedIconId) {
        this.renderer.deleteItem(this.renderer.selectedIconId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.modals.openShortcutModal();
      }
    });
  }
}

// ─── Start ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const app = new CanopyApp();
  app.init();
});
