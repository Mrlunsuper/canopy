/* ============================================================
   CANOPY — js/app.js
   Application orchestrator — wires all modules together
   ============================================================ */

import { snapToGrid, toast, uid, normalizeShortcutUrl, normalizeImageUrl } from './utils.js';
import { StorageManager }     from './StorageManager.js';
import { FaviconCache }       from './FaviconCache.js';
import { WallpaperManager }   from './WallpaperManager.js';
import { WallhavenManager }   from './WallhavenManager.js';
import { DesktopRenderer }    from './DesktopRenderer.js';
import { DragDropManager }    from './DragDropManager.js';
import { ContextMenuManager } from './ContextMenuManager.js';
import { ModalManager }       from './ModalManager.js';
import { BookmarkImporter }   from './BookmarkImporter.js';
import { ClockWidget }        from './ClockWidget.js';
import { CommandPalette }     from './CommandPalette.js';
import { MusicPlayer }        from './MusicPlayer.js';
import { PomodoroTimer }      from './PomodoroTimer.js';
import { StickyNotesManager } from './StickyNotesManager.js';
import { WeatherWidget }      from './WeatherWidget.js';

const WIDGET_LAYOUT_KEY = 'canopy_widget_layout';
const WIDGET_VISIBILITY_KEY = 'canopy_widget_visibility';
const WIDGET_VISIBILITY_DEFAULTS = {
  clock: true,
  music: true,
  weather: true,
  pomodoro: true,
  notes: true,
};

class CanopyApp {
  constructor() {
    // ── Data layer ──
    this.storage   = new StorageManager();
    this.faviconCache = new FaviconCache();
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
      this.faviconCache,
      item => this._openItem(item),          // onIconOpen
      (x, y, item) => this._onIconContext(x, y, item)  // onIconContext
    );

    // ── Context menus ──
    this.contextMenu = new ContextMenuManager(this.renderer);

    // ── Modals ──
    this.modals = new ModalManager(this.storage, this.renderer, item => this._openItem(item));

    // ── Bookmark importer ──
    this.bookmarks = new BookmarkImporter(
      this.storage,
      this.renderer,
      id => this.modals.closeModal(id)
    );

    // ── Wallhaven ──
    this.wallhaven = new WallhavenManager(this.wallpaper);

    // ── Widgets ──
    this.clock  = new ClockWidget();
    this.commandPalette = new CommandPalette(this.wallhaven);

    // ── Music Player ──
    this.music = new MusicPlayer();

    // ── Pomodoro Timer ──
    this.pomodoro = new PomodoroTimer();

    // ── Weather Widget ──
    this.weather = new WeatherWidget();

    // ── Sticky Notes ──
    this.stickyNotes = new StickyNotesManager();

    this.widgetVisibility = { ...WIDGET_VISIBILITY_DEFAULTS };
  }

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════

  async init() {
    // Load data
    await this.storage.loadData();

    // Load favicon cache
    await this.faviconCache.init();

    // Load and apply wallpaper
    const wp = await this.storage.loadWallpaper();
    if (wp) this.wallpaper.apply(wp);

    // Render desktop
    this.renderer.render();

    // Apply saved widget layout before widgets paint
    this._applyWidgetLayout(this._loadWidgetLayout(), false);
    this._applyWidgetVisibility(this._loadWidgetVisibility(), false);

    // Start clock
    this.clock.startTicking();

    // Init music player
    this.music.init();

    // Init pomodoro timer
    this.pomodoro.init();

    // Init weather widget
    this.weather.init();

    // Init sticky notes
    await this.stickyNotes.init();

    // Initialize drop zone
    this.dragDrop.initDropZone();

    // Wire all events
    this._wireEvents();

    // Initialize Lucide icons in the clock search button
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.getElementById('center-widget')] });

    // Listen for storage changes from the background context menu
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes['desktop_tab_data']) {
          this.storage.data = changes['desktop_tab_data'].newValue;
          this.renderer.render();
        }
      });
    }
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
      const safeUrl = normalizeShortcutUrl(item.url);
      if (!safeUrl) {
        toast('Blocked unsafe shortcut URL', 'error');
        return;
      }
      window.location.href = safeUrl;
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
  _loadWidgetLayout() {
    try {
      const saved = localStorage.getItem(WIDGET_LAYOUT_KEY);
      const layout = saved === 'card' || saved === 'vertical' ? 'card' : 'compact';
      if (saved && saved !== layout) {
        try { localStorage.setItem(WIDGET_LAYOUT_KEY, layout); } catch {}
      }
      return layout;
    } catch {
      return 'compact';
    }
  }

  /**
   * Apply the widget control layout globally.
   * @param {'compact'|'card'} layout
   * @param {boolean} persist
   * @private
   */
  _applyWidgetLayout(layout, persist = true) {
    const nextLayout = layout === 'card' || layout === 'vertical' ? 'card' : 'compact';
    const layoutLabel = nextLayout === 'card' ? 'Card' : 'Compact';
    const desktop = document.getElementById('desktop');
    if (desktop) {
      desktop.classList.toggle('widget-layout-vertical', nextLayout === 'card');
      desktop.classList.toggle('widget-layout-horizontal', nextLayout === 'compact');
    }

    document.querySelectorAll('.widget-layout-option').forEach(btn => {
      const active = btn.dataset.widgetLayout === nextLayout;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (persist) {
      try { localStorage.setItem(WIDGET_LAYOUT_KEY, nextLayout); } catch {}
      toast(`Widget layout: ${layoutLabel}`, 'success');
    }
  }

  /** @private */
  _loadWidgetVisibility() {
    try {
      const raw = localStorage.getItem(WIDGET_VISIBILITY_KEY);
      if (!raw) return { ...WIDGET_VISIBILITY_DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...WIDGET_VISIBILITY_DEFAULTS, ...parsed };
    } catch {
      return { ...WIDGET_VISIBILITY_DEFAULTS };
    }
  }

  /** @private */
  _saveWidgetVisibility() {
    try {
      localStorage.setItem(WIDGET_VISIBILITY_KEY, JSON.stringify(this.widgetVisibility));
    } catch {}
  }

  /** @private */
  _widgetElementMap() {
    return {
      clock: document.getElementById('center-widget'),
      music: document.getElementById('music-player'),
      weather: document.getElementById('weather-widget'),
      pomodoro: document.getElementById('pomodoro-player'),
      notes: document.getElementById('sticky-notes-layer'),
    };
  }

  /** @private */
  _applyWidgetVisibility(visibility, persist = true) {
    this.widgetVisibility = { ...WIDGET_VISIBILITY_DEFAULTS, ...visibility };
    const elements = this._widgetElementMap();

    Object.entries(elements).forEach(([id, el]) => {
      if (!el) return;
      const visible = this.widgetVisibility[id] !== false;
      el.classList.toggle('canopy-widget-disabled', !visible);
    });

    document.querySelectorAll('.widget-visibility-toggle').forEach(btn => {
      const visible = this.widgetVisibility[btn.dataset.widgetId] !== false;
      btn.classList.toggle('active', visible);
      btn.setAttribute('aria-pressed', String(visible));
      btn.title = visible ? 'Visible' : 'Hidden';
    });

    if (persist) {
      this._saveWidgetVisibility();
      toast('Widget visibility updated', 'success');
    }
  }

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
        const imported = this._sanitizeImportedData(JSON.parse(e.target.result));
        if (!imported) {
          toast('Invalid backup file', 'error');
          return;
        }

        this.storage.data = imported;
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
  _sanitizeImportedData(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;

    const seenIds = new Set();
    const items = [];
    raw.items.forEach(item => {
      const sanitized = this._sanitizeImportedItem(item, true, seenIds, 0);
      if (sanitized) items.push(sanitized);
    });

    return { items };
  }

  /** @private */
  _sanitizeImportedItem(item, isTopLevel, seenIds, depth) {
    if (!item || typeof item !== 'object' || depth > 5) return null;

    const id = this._sanitizeImportedId(item.id, seenIds);
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '';

    if (item.type === 'folder') {
      const children = Array.isArray(item.children)
        ? item.children
          .map(child => this._sanitizeImportedItem(child, false, seenIds, depth + 1))
          .filter(Boolean)
        : [];

      const folder = {
        id,
        type: 'folder',
        title: title || 'Folder',
        emoji: this._sanitizeImportedIconName(item.emoji),
        url: null,
        icon: null,
        children,
      };
      if (isTopLevel) folder.position = this._sanitizeImportedPosition(item.position);
      return folder;
    }

    if (item.type === 'shortcut') {
      const url = normalizeShortcutUrl(item.url);
      if (!url) return null;

      const shortcut = {
        id,
        type: 'shortcut',
        title: title || new URL(url).hostname.replace('www.', ''),
        url,
        icon: normalizeImageUrl(item.icon) || null,
        children: [],
      };
      if (isTopLevel) shortcut.position = this._sanitizeImportedPosition(item.position);
      return shortcut;
    }

    return null;
  }

  /** @private */
  _sanitizeImportedId(id, seenIds) {
    const candidate = typeof id === 'string' ? id.trim().slice(0, 80) : '';
    if (candidate && !seenIds.has(candidate)) {
      seenIds.add(candidate);
      return candidate;
    }

    let nextId;
    do {
      nextId = uid();
    } while (seenIds.has(nextId));
    seenIds.add(nextId);
    return nextId;
  }

  /** @private */
  _sanitizeImportedIconName(iconName) {
    return typeof iconName === 'string' && /^[a-z0-9-]{1,50}$/i.test(iconName)
      ? iconName
      : 'folder';
  }

  /** @private */
  _sanitizeImportedPosition(position) {
    const x = Number(position?.x);
    const y = Number(position?.y);
    return {
      x: Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0,
      y: Number.isFinite(y) ? Math.max(0, Math.round(y)) : 0,
    };
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
      this._showSettingsSection('appearance');
    }, { once: true });
  }

  /** @private */
  _showSettingsSection(section) {
    document.querySelectorAll('.settings-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.section === section);
    });
    document.querySelectorAll('.settings-content-panel').forEach(p => {
      p.classList.toggle('active', p.id === `settings-${section}`);
    });
  }

  /** @private */
  _initSettingsNavigation() {
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._showSettingsSection(btn.dataset.section);
      });
    });
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.getElementById('settings-sidebar')] });
  }

  /** @private */
  _initSettingsSearch() {
    const searchInput = document.getElementById('settings-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const navItems = document.querySelectorAll('.settings-nav-item');

      navItems.forEach(btn => {
        const label = btn.textContent.trim().toLowerCase();
        const match = !query || label.includes(query);
        btn.classList.toggle('hidden', !match);
      });

      if (query) {
        const visible = [...navItems].filter(b => !b.classList.contains('hidden'));
        if (visible.length === 1) {
          this._showSettingsSection(visible[0].dataset.section);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  EVENT WIRING
  // ═══════════════════════════════════════════════

  /** @private */
  _wireEvents() {
    // Wire sub-module events
    this.modals.wireEvents();
    this.bookmarks.wireEvents();
    this.commandPalette.wireEvents();

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
        const layerRect = document.getElementById('sticky-notes-layer').getBoundingClientRect();
        this.contextMenu.pendingNotePosition = { x: e.clientX - layerRect.left, y: e.clientY - layerRect.top };
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

    document.getElementById('ctx-add-note').addEventListener('click', () => {
      this.contextMenu.hide();
      const pos = this.contextMenu.pendingNotePosition || this.contextMenu.pendingPosition;
      this.stickyNotes.create(pos);
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

    document.getElementById('ctx-move-desktop').addEventListener('click', () => {
      const item = this.contextMenu.contextTarget;
      this.contextMenu.hide();
      if (item) this.renderer.moveItemToDesktop(item.id);
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

    document.getElementById('ctx-refresh').addEventListener('click', () => {
      this.contextMenu.hide();
      const desktop = document.getElementById('desktop');
      desktop.classList.add('refreshing');
      this.renderer.render();
      setTimeout(() => desktop.classList.remove('refreshing'), 400);
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

    // ── Wallhaven ──
    document.getElementById('btn-open-wallhaven').addEventListener('click', () => {
      this._closeSettingsPanel();
      setTimeout(() => this.wallhaven.open(), 180);
    });

    document.getElementById('wh-modal-search-btn').addEventListener('click', () => {
      const q = document.getElementById('wh-modal-query').value;
      this.wallhaven.search(q);
    });

    document.getElementById('wh-modal-query').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value;
        this.wallhaven.search(q);
      }
    });

    document.getElementById('wallhaven-modal').addEventListener('click', e => {
      if (e.target.id === 'wallhaven-modal') {
        this.wallhaven.close();
      }
    });

    // ── Wallhaven preview ──
    document.getElementById('wh-preview-close').addEventListener('click', () => {
      this.wallhaven.closePreview();
    });

    document.getElementById('wh-preview').addEventListener('click', e => {
      if (e.target.id === 'wh-preview') {
        this.wallhaven.closePreview();
      }
    });

    document.getElementById('wh-preview-prev').addEventListener('click', () => {
      this.wallhaven.prevPreview();
    });

    document.getElementById('wh-preview-next').addEventListener('click', () => {
      this.wallhaven.nextPreview();
    });

    document.getElementById('wh-preview-set').addEventListener('click', () => {
      if (this.wallhaven.previewWp) {
        this.wallhaven.apply(this.wallhaven.previewWp);
        this.wallhaven.closePreview();
      }
    });

    document.getElementById('wh-preview-dl').addEventListener('click', () => {
      if (this.wallhaven.previewWp) {
        this.wallhaven.download(this.wallhaven.previewWp);
      }
    });

    // ── Widget layout ──
    document.querySelectorAll('.widget-layout-option').forEach(btn => {
      btn.addEventListener('click', () => this._applyWidgetLayout(btn.dataset.widgetLayout));
    });
    this._applyWidgetLayout(this._loadWidgetLayout(), false);

    document.querySelectorAll('.widget-visibility-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.widgetId;
        this._applyWidgetVisibility({
          ...this.widgetVisibility,
          [id]: this.widgetVisibility[id] === false,
        });
      });
    });
    this._applyWidgetVisibility(this._loadWidgetVisibility(), false);

    // ── Settings data ──
    document.getElementById('btn-export-data').addEventListener('click', () => this._exportData());
    document.getElementById('import-data-file').addEventListener('change', e => this._importDataFromFile(e.target.files[0]));
    document.getElementById('btn-reset-data').addEventListener('click', () => this._resetData());

    // ── Keyboard shortcuts ──
    this._wireKeyboardShortcuts();

    // ── Settings sidebar navigation ──
    this._initSettingsNavigation();
    this._initSettingsSearch();
  }

  /** @private */
  _wireKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        // Check preview first (higher z-index)
        if (!document.getElementById('wh-preview').classList.contains('hidden')) {
          this.wallhaven.closePreview();
          return;
        }
        ['shortcut-modal', 'folder-modal-create', 'import-modal', 'folder-overlay', 'wallhaven-modal'].forEach(id => {
          if (!document.getElementById(id).classList.contains('hidden')) {
            this.modals.closeModal(id);
          }
        });
        this._closeSettingsPanel();
        this.contextMenu.hide();
        this.contextMenu.hideArrangeMenu();
        this.renderer.clearSelection();
        this.commandPalette.hide();
      }

      // ── Music player media keys ──
      if (e.code === 'MediaPlayPause') {
        e.preventDefault();
        this.music.toggle();
        return;
      }
      if (e.code === 'MediaTrackPrevious') {
        e.preventDefault();
        this.music.prevTrack();
        return;
      }
      if (e.code === 'MediaTrackNext') {
        e.preventDefault();
        this.music.nextTrack();
        return;
      }
      if (e.code === 'MediaStop') {
        e.preventDefault();
        if (!this.music.audio.paused) this.music.toggle();
        return;
      }
      // Preview navigation arrows
      if (!document.getElementById('wh-preview').classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.wallhaven.prevPreview();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.wallhaven.nextPreview();
          return;
        }
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName || '';
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
          e.preventDefault();
          this.commandPalette.show();
        }
      }
      if (e.key === 'Delete' && this.renderer.selectedIconId) {
        this.renderer.deleteItem(this.renderer.selectedIconId);
      }
      // F2: inline rename selected icon
      if (e.key === 'F2' && this.renderer.selectedIconId) {
        e.preventDefault();
        this.renderer.startRename(this.renderer.selectedIconId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.modals.openShortcutModal();
      }

      // Space: play/pause (when not in input/textarea)
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName || '';
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) &&
            !document.activeElement?.isContentEditable) {
          e.preventDefault();
          this.music.toggle();
        }
      }
    });
  }
}

// ─── Start ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const app = new CanopyApp();
  app.init();
});
