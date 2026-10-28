/* ============================================================
   CANOPY — js/app.js
   Application orchestrator — wires all modules together
   ============================================================ */

import {
  snapToGrid,
  toast,
  uid,
  normalizeShortcutUrl,
  normalizeImageUrl,
  STORAGE_KEY,
  WALLPAPER_KEY,
  THEME_KEY,
  AUDIO_CONFIG_KEY,
  MUSIC_CONFIG_KEY,
  AMBIENT_CONFIG_KEY,
  STICKY_NOTES_KEY,
  DELETED_NOTES_KEY,
  FAVICON_CACHE_KEY,
} from './utils.js';
import { validateBackup } from './BackupValidator.js';
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
import { AudioPlayer }        from './AudioPlayer.js';
import { PomodoroTimer }      from './PomodoroTimer.js';
import { StickyNotesManager } from './StickyNotesManager.js';
import { WeatherWidget }      from './WeatherWidget.js';
import { TodayPanel }         from './TodayPanel.js';
import { FocusMode }          from './FocusMode.js';

const WIDGET_VISIBILITY_KEY = 'canopy_widget_visibility';
const WIDGET_LAYOUT_KEY = 'canopy_widget_layout';
const WIDGET_LAYOUT_DEFAULT = 'today';
const DESKTOP_ICONS_VISIBLE_KEY = 'canopy_desktop_icons_visible';
const BACKUP_VERSION = 2;
const LAST_BACKUP_KEY = 'canopy_last_backup';
const BACKUP_CHROME_KEYS = [
  STORAGE_KEY,
  WALLPAPER_KEY,
  THEME_KEY,
  AUDIO_CONFIG_KEY,
  MUSIC_CONFIG_KEY,
  AMBIENT_CONFIG_KEY,
  STICKY_NOTES_KEY,
  DELETED_NOTES_KEY,
  FAVICON_CACHE_KEY,
];
const BACKUP_LOCAL_KEYS = [
  STORAGE_KEY,
  WALLPAPER_KEY,
  THEME_KEY,
  AUDIO_CONFIG_KEY,
  MUSIC_CONFIG_KEY,
  AMBIENT_CONFIG_KEY,
  STICKY_NOTES_KEY,
  DELETED_NOTES_KEY,
  FAVICON_CACHE_KEY,
  'pomodoro_config',
  'canopy_clock_position',
  'canopy_clock_size',
  'canopy_weather_config',
  'canopy_weather_cache',
  'canopy_today_panel_position',
  WIDGET_VISIBILITY_KEY,
  WIDGET_LAYOUT_KEY,
  DESKTOP_ICONS_VISIBLE_KEY,
];
const WIDGET_VISIBILITY_DEFAULTS = {
  clock: true,
  audio: true,
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
    this.commandPalette = new CommandPalette(this.wallhaven, this.storage, item => this._openItem(item));

    // ── Audio Player ──
    this.audio = new AudioPlayer();

    // ── Pomodoro Timer ──
    this.pomodoro = new PomodoroTimer();

    // ── Weather Widget ──
    this.weather = new WeatherWidget();

    // ── Sticky Notes ──
    this.stickyNotes = new StickyNotesManager();

    // ── Today / Focus Panel ──
    this.todayPanel = new TodayPanel({
      clock: this.clock,
      weather: this.weather,
      pomodoro: this.pomodoro,
      audio: this.audio,
    });

    this.widgetLayout = WIDGET_LAYOUT_DEFAULT;
    this.widgetVisibility = { ...WIDGET_VISIBILITY_DEFAULTS };
    this.desktopIconsVisible = true;
  }

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════

  async init() {
    // Load data
    await this.storage.loadData();

    this._applyDesktopIconsVisibility(this._loadDesktopIconsVisibility(), false);

    // Load favicon cache
    await this.faviconCache.init();

    // Load and apply wallpaper
    const wp = await this.storage.loadWallpaper();
    if (typeof wp === 'string') this.wallpaper.apply(wp);

    // Render desktop
    this.renderer.render();

    this.widgetLayout = this._loadWidgetLayout();
    this._applyTheme(this._loadTheme(), false);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this._loadTheme() === 'system') this._applyTheme('system', false);
      });
    }

    // Apply saved widget visibility before widgets paint
    this._applyWidgetVisibility(this._loadWidgetVisibility(), false);

    // Start clock
    this.clock.startTicking();

    // Init audio player
    this.audio.init();

    // Init pomodoro timer
    this.pomodoro.init();

    // Init weather widget
    this.weather.init();

    // Init sticky notes
    await this.stickyNotes.init();

    // Init Today / Focus Panel after source widgets have painted
    this.todayPanel.init(this.widgetVisibility);
    this.focusMode = new FocusMode({ pomodoro: this.pomodoro, audio: this.audio });
    this.focusMode.init();
    this._applyWidgetLayout(this.widgetLayout, false);

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
          this.storage.acceptExternal(changes[STORAGE_KEY].newValue);
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
    const currentItem = this.storage.findItem(item.id);
    if (!currentItem) return;

    if (currentItem.type === 'folder') {
      this.modals.openFolderOverlay(currentItem);
    } else if (currentItem.url) {
      const safeUrl = normalizeShortcutUrl(currentItem.url);
      if (!safeUrl) {
        toast('URL blocked', 'error');
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
  _loadDesktopIconsVisibility() {
    try {
      return localStorage.getItem(DESKTOP_ICONS_VISIBLE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  /** @private */
  _saveDesktopIconsVisibility() {
    try {
      localStorage.setItem(DESKTOP_ICONS_VISIBLE_KEY, String(this.desktopIconsVisible));
    } catch {}
  }

  /** @private */
  _applyDesktopIconsVisibility(visible, persist = true) {
    this.desktopIconsVisible = visible !== false;

    const desktop = document.getElementById('desktop');
    desktop?.classList.toggle('desktop-icons-hidden', !this.desktopIconsVisible);

    const btn = document.getElementById('desktop-icons-toggle');
    if (btn) {
      btn.classList.toggle('active', this.desktopIconsVisible);
      btn.setAttribute('aria-pressed', String(this.desktopIconsVisible));
      btn.title = this.desktopIconsVisible ? 'Desktop icons are visible' : 'Desktop icons are hidden';

      const label = 'Desktop icons';
      const iconName = this.desktopIconsVisible ? 'eye' : 'eye-off';
      btn.innerHTML = `<i data-lucide="${iconName}"></i> ${label}`;
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] });
    }

    if (!this.desktopIconsVisible) {
      this.renderer?.clearSelection();
      this.contextMenu?.hide();
    }

    if (persist) {
      this._saveDesktopIconsVisibility();
      toast(this.desktopIconsVisible ? 'Icons shown' : 'Icons hidden', 'success');
    }
  }

  /** @private */
  _loadWidgetVisibility() {
    try {
      const raw = localStorage.getItem(WIDGET_VISIBILITY_KEY);
      if (!raw) return { ...WIDGET_VISIBILITY_DEFAULTS };
      const parsed = JSON.parse(raw);
      if (parsed.audio === undefined && (parsed.music !== undefined || parsed.ambient !== undefined)) {
        parsed.audio = parsed.music !== false || parsed.ambient !== false;
      }
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
  _loadWidgetLayout() {
    try {
      const saved = localStorage.getItem(WIDGET_LAYOUT_KEY);
      return saved === 'separate' ? 'separate' : WIDGET_LAYOUT_DEFAULT;
    } catch {
      return WIDGET_LAYOUT_DEFAULT;
    }
  }
  /** @private */
  _loadTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
  }
  /** @private */
  _applyTheme(theme, persist = true) {
    if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch {} }
    if (theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    document.querySelectorAll('#theme-switch .theme-option').forEach(btn => {
      const active = btn.dataset.themeVal === theme;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /** @private */
  _saveWidgetLayout() {
    try {
      localStorage.setItem(WIDGET_LAYOUT_KEY, this.widgetLayout);
    } catch {}
  }

  /** @private */
  _widgetElementMap() {
    return {
      clock: document.getElementById('center-widget'),
      audio: document.getElementById('audio-player'),
      weather: document.getElementById('weather-widget'),
      pomodoro: document.getElementById('pomodoro-player'),
      notes: document.getElementById('sticky-notes-layer'),
    };
  }

  /** @private */
  _standaloneWidgetIds() {
    return ['clock', 'audio', 'weather', 'pomodoro'];
  }

  /** @private */
  _applyWidgetVisibility(visibility, persist = true) {
    this.widgetVisibility = { ...WIDGET_VISIBILITY_DEFAULTS, ...visibility };
    this.todayPanel?.setVisibility(this.widgetVisibility);
    this._applyWidgetLayout(this.widgetLayout, false);

    if (persist) {
      this._saveWidgetVisibility();
      toast('Widgets updated', 'success');
    }
  }

  /** @private */
  _applyWidgetLayout(layout = WIDGET_LAYOUT_DEFAULT, persist = true) {
    this.widgetLayout = layout === 'separate' ? 'separate' : WIDGET_LAYOUT_DEFAULT;
    const elements = this._widgetElementMap();
    const useTodayPanel = this.widgetLayout === 'today';

    Object.entries(elements).forEach(([id, el]) => {
      if (!el) return;
      const visible = this.widgetVisibility[id] !== false;
      const disabled = id === 'notes'
        ? !visible
        : useTodayPanel || !visible;
      el.classList.toggle('canopy-widget-disabled', disabled);
    });

    const todayPanel = document.getElementById('today-panel');
    const panelHasVisibleModule = this._standaloneWidgetIds().some(id => this.widgetVisibility[id] !== false);
    todayPanel?.classList.toggle('hidden', !useTodayPanel || !panelHasVisibleModule);
    this.todayPanel?.setVisibility(this.widgetVisibility);

    document.querySelectorAll('.widget-visibility-toggle').forEach(btn => {
      const visible = this.widgetVisibility[btn.dataset.widgetId] !== false;
      btn.classList.toggle('active', visible);
      btn.setAttribute('aria-pressed', String(visible));
      btn.title = visible ? 'Visible' : 'Hidden';
    });

    document.querySelectorAll('.widget-layout-option').forEach(btn => {
      const active = btn.dataset.widgetLayout === this.widgetLayout;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (persist) {
      this._saveWidgetLayout();
      toast(this.widgetLayout === 'today' ? 'Compact layout' : 'Separate layout', 'success');
    }
  }

  /** @private */
  async _exportData() {
    if (!(await this.storage.flush()) || !(await this.stickyNotes.flush())) {
      toast('Export cancelled: pending changes could not be saved.', 'error');
      return;
    }
    const backup = {
      app: 'canopy',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      chromeStorage: await this._readChromeStorage(BACKUP_CHROME_KEYS),
      localStorage: this._readLocalStorage(BACKUP_LOCAL_KEYS),
    };
    backup.chromeStorage[STORAGE_KEY] = this.storage.data;

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const datePart = new Date().toISOString().slice(0, 10);
    a.download = `canopy-${datePart}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup saved', 'success');
  }

  /** @private */
  _saveLastBackup() {
    try {
      localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: this.storage.data,
      }));
    } catch {
      throw new Error('Safety backup could not be saved. Free storage before continuing.');
    }
  }

  /** @private */
  _countAllItems(list = this.storage.data.items) {
    let count = 0;
    for (const item of list) {
      count += 1;
      if (item.children?.length) count += this._countAllItems(item.children);
    }
    return count;
  }

  /** @private */
  _importDataFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const parsed = JSON.parse(e.target.result);
        validateBackup(parsed);
        const imported = this._sanitizeImportedData(parsed);
        if (!imported) {
          toast('Invalid backup file', 'error');
          return;
        }

        const currentCount = this._countAllItems();
        const incomingCount = this._countAllItems(imported.items || []);
        const ok = confirm(
          `Import ${incomingCount} items? This replaces your current ${currentCount} items and, for a full backup, widget settings. Only a desktop safety backup is saved automatically; export a full backup first to keep current widgets.`
        );
        if (!ok) return;

        if (!(await this.storage.flush()) || !(await this.stickyNotes.flush())) {
          throw new Error('Save pending changes successfully before importing.');
        }
        this._saveLastBackup();
        await this._restoreImportedData(parsed, imported);
        this.renderer.render(true);
        toast('Backup restored', 'success');
        setTimeout(() => window.location.reload(), 300);
      } catch (error) {
        toast(`Import failed: ${error.message}`, 'error');
      } finally {
        const input = document.getElementById('import-data-file');
        if (input) input.value = '';
      }
    };
    reader.readAsText(file);
  }

  /** @private */
  _readChromeStorage(keys) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        resolve({});
        return;
      }
      chrome.storage.local.get(keys, result => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(result || {});
      });
    });
  }

  /** @private */
  _writeChromeStorage(values) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !values || Object.keys(values).length === 0) {
        resolve();
        return;
      }
      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }

  /** @private */
  _removeChromeStorage(keys) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !keys.length) {
        resolve();
        return;
      }
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }

  /** @private */
  _readLocalStorage(keys) {
    const values = {};
    keys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) values[key] = value;
      } catch { /* ignore */ }
    });
    return values;
  }

  /** @private */
  async _restoreImportedData(raw, desktopData) {
    if (this._isFullBackup(raw)) {
      const chromeValues = {};
      Object.entries(raw.chromeStorage || {}).forEach(([key, value]) => {
        if (BACKUP_CHROME_KEYS.includes(key)) chromeValues[key] = value;
      });
      chromeValues[STORAGE_KEY] = desktopData;
      const chromeRemoveKeys = BACKUP_CHROME_KEYS.filter(key => !(key in chromeValues));
      const restore = async () => {
        const previousChrome = await this._readChromeStorage(BACKUP_CHROME_KEYS);
        const previousLocal = this._readLocalStorage(BACKUP_LOCAL_KEYS);
        try {
          // Write first: a quota failure must not delete existing keys.
          await this._writeChromeStorage(chromeValues);
          await this._removeChromeStorage(chromeRemoveKeys);
          for (const key of BACKUP_LOCAL_KEYS) {
            if (key in raw.localStorage) localStorage.setItem(key, raw.localStorage[key]);
            else localStorage.removeItem(key);
          }
        } catch (error) {
          try {
            await this._removeChromeStorage(BACKUP_CHROME_KEYS.filter(key => !(key in previousChrome)));
            await this._writeChromeStorage(previousChrome);
            for (const key of BACKUP_LOCAL_KEYS) {
              if (key in previousLocal) localStorage.setItem(key, previousLocal[key]);
              else localStorage.removeItem(key);
            }
          } catch (rollbackError) {
            console.error('Backup rollback failed:', rollbackError);
            throw new Error('Restore and rollback failed. Keep your backup file and retry.');
          }
          throw error;
        }
      };
      if (typeof chrome !== 'undefined' && chrome.storage) await globalThis.CanopyPersistence.locked(restore);
      else await restore();
    } else {
      const previous = this.storage.data;
      this.storage.data = desktopData;
      if (!(await this.storage.saveData())) {
        this.storage.data = previous;
        throw new Error('Desktop data could not be saved');
      }
    }

    this.storage.data = desktopData;
    this.storage._baseline = globalThis.CanopyPersistence.clone(desktopData);
  }

  /** @private */
  _isFullBackup(raw) {
    return raw
      && typeof raw === 'object'
      && raw.app === 'canopy'
      && raw.version >= 2
      && raw.chromeStorage
      && typeof raw.chromeStorage === 'object';
  }

  /** @private */
  _sanitizeImportedData(raw) {
    const source = this._isFullBackup(raw) ? raw.chromeStorage?.[STORAGE_KEY] : raw;
    if (!source || typeof source !== 'object' || !Array.isArray(source.items)) return null;

    const seenIds = new Set();
    const items = [];
    source.items.forEach(item => {
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
    if (/^[a-zA-Z0-9_-]{1,80}$/.test(candidate) && !seenIds.has(candidate)) {
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
  async _resetData() {
    const count = this._countAllItems();
    if (!confirm(`Delete all ${count} desktop items? Use Restore last desktop backup to undo.`)) return;
    try {
      if (!(await this.storage.flush())) throw new Error('Pending changes are not saved');
      this._saveLastBackup();
      const previous = this.storage.data;
      this.storage.data = { items: [] };
      if (!(await this.storage.saveData())) {
        this.storage.data = previous;
        this.renderer.render();
        return;
      }
      this.renderer.render();
      toast('Desktop cleared. A safety backup is available in Settings.', 'info');
    } catch (error) { toast(error.message, 'error'); }
  }

  async _restoreLastBackup() {
    try {
      const backup = JSON.parse(localStorage.getItem(LAST_BACKUP_KEY));
      const data = this._sanitizeImportedData(backup?.data);
      if (!data) throw new Error('No valid desktop safety backup found');
      if (!confirm('Restore the last desktop backup? Current desktop items will be replaced.')) return;
      await this.storage.flush();
      const previous = this.storage.data;
      this.storage.data = data;
      if (!(await this.storage.saveData())) this.storage.data = previous;
      this.renderer.render(true);
    } catch (error) { toast(error.message, 'error'); }
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

    document.getElementById('desktop-empty')?.addEventListener('click', e => e.stopPropagation());
    document.getElementById('empty-add-shortcut')?.addEventListener('click', () => this.modals.openShortcutModal());
    document.getElementById('empty-import-bookmarks')?.addEventListener('click', () => this.bookmarks.openImportModal());
    window.addEventListener('canopy:open-audio-settings', () => {
      document.getElementById('settings-panel').classList.remove('hidden');
      this._showSettingsSection('audio');
      document.querySelector('#music-add-track input')?.focus();
    });

    // Range progress and accessible names are shared across compact/separate widgets.
    const paintRange = slider => {
      const min = Number(slider.min) || 0;
      const max = Number(slider.max) || 100;
      const percent = max > min ? Math.max(0, Math.min(100, (Number(slider.value) - min) / (max - min) * 100)) : 0;
      slider.style.setProperty('--range-progress', `${percent}%`);
    };
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      paintRange(slider);
      if (slider.title) slider.setAttribute('aria-label', slider.title);
    });
    document.querySelectorAll('button[title]').forEach(button => {
      if (!button.textContent.trim()) button.setAttribute('aria-label', button.title);
    });
    document.addEventListener('input', e => {
      if (e.target.matches('input[type="range"]')) paintRange(e.target);
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
      if (!file.type.startsWith('image/')) {
        toast('Choose an image file', 'error');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = async ev => {
        try {
          await this.wallpaper.setUpload(ev.target.result);
          toast('Wallpaper updated', 'success');
        } catch {
          toast('Image too large or invalid', 'error');
        } finally {
          e.target.value = '';
        }
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
    // ── Theme switch ──
    document.querySelectorAll('#theme-switch .theme-option').forEach(btn => {
      btn.addEventListener('click', () => this._applyTheme(btn.dataset.themeVal));
    });


    // ── Widget visibility ──
    document.querySelectorAll('.widget-layout-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this._applyWidgetLayout(btn.dataset.widgetLayout);
      });
    });

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

    document.getElementById('desktop-icons-toggle')?.addEventListener('click', () => {
      this._applyDesktopIconsVisibility(!this.desktopIconsVisible);
    });
    this._applyDesktopIconsVisibility(this._loadDesktopIconsVisibility(), false);

    // ── Settings data ──
    document.getElementById('btn-export-data').addEventListener('click', () => {
      this._exportData().catch(error => toast(`Export failed: ${error.message}`, 'error'));
    });
    document.getElementById('import-data-file').addEventListener('change', e => this._importDataFromFile(e.target.files[0]));
    document.getElementById('btn-reset-data').addEventListener('click', () => this._resetData());
    document.getElementById('btn-restore-last-backup').addEventListener('click', () => this._restoreLastBackup());

    // ── Keyboard shortcuts ──
    this._wireKeyboardShortcuts();

    // ── Settings sidebar navigation ──
    this._initSettingsNavigation();
    this._initSettingsSearch();
  }

  /** @private */
  _isModalOpen() {
    return ['shortcut-modal', 'folder-modal-create', 'import-modal', 'folder-overlay', 'wallhaven-modal', 'wh-preview'].some(id => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    }) || !document.getElementById('settings-panel')?.classList.contains('hidden');
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

      // ── Audio player media keys control music only ──
      if (e.code === 'MediaPlayPause') {
        e.preventDefault();
        this.audio.toggleMusic();
        return;
      }
      if (e.code === 'MediaTrackPrevious') {
        e.preventDefault();
        this.audio.prevTrack();
        return;
      }
      if (e.code === 'MediaTrackNext') {
        e.preventDefault();
        this.audio.nextTrack();
        return;
      }
      if (e.code === 'MediaStop') {
        e.preventDefault();
        this.audio.stopMusic();
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
        const tag = document.activeElement?.tagName || '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        if (document.activeElement?.isContentEditable) return;
        if (this._isModalOpen() || this.commandPalette.visible) return;
        this.renderer.deleteItem(this.renderer.selectedIconId);
      }
      // Ctrl/Cmd+Z: restore last deleted icon
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        const tag = document.activeElement?.tagName || '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        if (document.activeElement?.isContentEditable) return;
        if (this._isModalOpen() || this.commandPalette.visible) return;
        if (this.renderer.restoreLastDeleted()) {
          e.preventDefault();
          return;
        }
      }
      // F2: inline rename selected icon
      if (e.key === 'F2' && this.renderer.selectedIconId) {
        e.preventDefault();
        this.renderer.startRename(this.renderer.selectedIconId);
        return;
      }
      // Alt+N: new shortcut (Ctrl+N is taken by Chrome for new window)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
        const tag = document.activeElement?.tagName || '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        if (document.activeElement?.isContentEditable) return;
        if (this._isModalOpen() || this.commandPalette.visible) return;
        e.preventDefault();
        this.modals.openShortcutModal();
        return;
      }

      // Space: play/pause (when not in input/textarea/button)
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName || '';
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
        if (document.activeElement?.isContentEditable) return;
        if (this._isModalOpen() || this.commandPalette.visible) return;
        if (!document.activeElement || document.activeElement === document.body) {
          e.preventDefault();
          this.audio.toggleMusic();
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
