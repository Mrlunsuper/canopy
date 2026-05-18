# Settings Page Rework — Implementation Plan

## Files to modify: `newtab.html`, `styles.css`, `js/app.js`

---

## 1. `newtab.html` — Replace settings panel (lines 192-325)

Replace the entire `<div id="settings-panel" ...>` through its closing `</div>` with:

```html
  <div id="settings-panel" class="hidden">
    <div id="settings-header">
      <h2><i data-lucide="settings"></i> Settings</h2>
      <button id="settings-close"><i data-lucide="x"></i></button>
    </div>
    <div id="settings-body">
      <nav id="settings-sidebar">
        <input type="text" id="settings-search" placeholder="Search settings..." autocomplete="off" />
        <button class="settings-nav-item active" data-section="appearance">
          <i data-lucide="image"></i> Appearance
        </button>
        <button class="settings-nav-item" data-section="data">
          <i data-lucide="database"></i> Data
        </button>
        <button class="settings-nav-item" data-section="widgets">
          <i data-lucide="layout-dashboard"></i> Widgets
        </button>
        <button class="settings-nav-item" data-section="music">
          <i data-lucide="music"></i> Music
        </button>
        <button class="settings-nav-item" data-section="timer">
          <i data-lucide="timer"></i> Timer
        </button>
        <button class="settings-nav-item" data-section="weather">
          <i data-lucide="cloud-sun"></i> Weather
        </button>
        <button class="settings-nav-item" data-section="notes">
          <i data-lucide="trash-2"></i> Notes
        </button>
        <button class="settings-nav-item" data-section="about">
          <i data-lucide="info"></i> About
        </button>
      </nav>
      <div id="settings-content">
        <div id="settings-appearance" class="settings-content-panel active">
          <section class="settings-section">
            <h3><i data-lucide="image"></i> Wallpaper</h3>
            <div id="wallpaper-presets">
              <div class="wp-preset active" data-wp="default" title="Nebula"></div>
              <div class="wp-preset" data-wp="aurora" title="Aurora"></div>
              <div class="wp-preset" data-wp="sunset" title="Ocean Night"></div>
              <div class="wp-preset" data-wp="rose" title="Violet"></div>
              <div class="wp-preset" data-wp="forest" title="Forest"></div>
              <div class="wp-preset" data-wp="desert" title="Ember"></div>
              <div class="wp-preset" data-wp="midnight" title="Midnight"></div>
              <div class="wp-preset" data-wp="neon" title="Neon Abyss"></div>
              <div class="wp-preset" data-wp="candy" title="Candy"></div>
              <div class="wp-preset" data-wp="arctic" title="Arctic"></div>
              <div class="wp-preset" data-wp="lava" title="Lava"></div>
              <div class="wp-preset" data-wp="teal" title="Teal Deep"></div>
              <div class="wp-preset" data-wp="sakura" title="Sakura"></div>
              <div class="wp-preset" data-wp="cosmic" title="Cosmic Blue"></div>
              <div class="wp-preset" data-wp="copper" title="Copper"></div>
              <div class="wp-preset" data-wp="slate" title="Slate"></div>
              <div class="wp-preset" data-wp="jungle" title="Jungle"></div>
              <div class="wp-preset" data-wp="galaxy" title="Galaxy"></div>
            </div>
            <div id="wallpaper-upload-row">
              <label for="wallpaper-upload" class="upload-label"><i data-lucide="upload"></i> Upload wallpaper</label>
              <input type="file" id="wallpaper-upload" accept="image/*" />
            </div>
          </section>
          <section class="settings-section">
            <h3><i data-lucide="globe"></i> Wallhaven</h3>
            <button id="btn-open-wallhaven" class="settings-btn"><i data-lucide="search"></i> Search Wallhaven.cc</button>
          </section>
        </div>

        <div id="settings-data" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="database"></i> Data</h3>
            <button id="btn-export-data" class="settings-btn"><i data-lucide="download"></i> Export JSON data</button>
            <label for="import-data-file" class="settings-btn"><i data-lucide="upload"></i> Import JSON data</label>
            <input type="file" id="import-data-file" accept=".json" />
            <button id="btn-reset-data" class="settings-btn danger"><i data-lucide="trash-2"></i> Reset all data</button>
          </section>
        </div>

        <div id="settings-widgets" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="layout-dashboard"></i> Widgets</h3>
            <div id="widget-layout-settings">
              <span class="settings-info">Choose how widget controls are arranged.</span>
              <div class="widget-layout-toggle" role="group" aria-label="Widget layout">
                <button class="settings-btn compact widget-layout-option" data-widget-layout="compact" type="button">
                  <i data-lucide="panel-top"></i> Compact
                </button>
                <button class="settings-btn compact widget-layout-option" data-widget-layout="card" type="button">
                  <i data-lucide="panel-left"></i> Card
                </button>
              </div>
            </div>
          </section>
        </div>

        <div id="settings-music" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="music"></i> Music Player</h3>
            <div id="music-r2-config">
              <button id="music-sync-btn" class="settings-btn"><i data-lucide="refresh-cw"></i> Sync from R2</button>
            </div>
            <div id="music-track-list"></div>
            <div id="music-add-track">
              <input type="text" id="music-new-name" placeholder="Track name" />
              <input type="url" id="music-new-url" placeholder="MP3 URL" />
              <button id="music-add-btn" class="settings-btn"><i data-lucide="plus"></i> Add track</button>
            </div>
            <button id="music-reset-defaults" class="settings-btn">Reset to defaults</button>
          </section>
        </div>

        <div id="settings-timer" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="timer"></i> Pomodoro Timer</h3>
            <div id="pomodoro-settings">
              <div class="pomodoro-setting-row">
                <label for="pomodoro-work-min">Focus duration</label>
                <div class="pomodoro-input-group">
                  <input type="number" id="pomodoro-work-min" min="1" max="120" value="25" />
                  <span class="pomodoro-unit">min</span>
                </div>
              </div>
              <div class="pomodoro-setting-row">
                <label for="pomodoro-short-min">Short break</label>
                <div class="pomodoro-input-group">
                  <input type="number" id="pomodoro-short-min" min="1" max="60" value="5" />
                  <span class="pomodoro-unit">min</span>
                </div>
              </div>
              <div class="pomodoro-setting-row">
                <label for="pomodoro-long-min">Long break</label>
                <div class="pomodoro-input-group">
                  <input type="number" id="pomodoro-long-min" min="1" max="60" value="15" />
                  <span class="pomodoro-unit">min</span>
                </div>
              </div>
            </div>
            <button id="pomodoro-reset-sessions" class="settings-btn"><i data-lucide="rotate-ccw"></i> Reset session count</button>
          </section>
        </div>

        <div id="settings-weather" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="cloud-sun"></i> Weather</h3>
            <div id="weather-settings">
              <div class="weather-setting-row">
                <label for="weather-city-input">City</label>
                <div class="weather-input-group">
                  <input type="text" id="weather-city-input" placeholder="Search city..." />
                  <button id="weather-city-search" class="settings-btn compact"><i data-lucide="search"></i></button>
                </div>
              </div>
              <div class="weather-setting-row">
                <label>Temperature unit</label>
                <button id="weather-unit-toggle" class="settings-btn compact">°C</button>
              </div>
            </div>
          </section>
        </div>

        <div id="settings-notes" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="trash-2"></i> Recently Deleted Notes</h3>
            <div id="deleted-notes-container"></div>
          </section>
        </div>

        <div id="settings-about" class="settings-content-panel">
          <section class="settings-section">
            <h3><i data-lucide="info"></i> Information</h3>
            <p class="settings-info">Canopy v1.1.0</p>
            <p class="settings-info">Drag & drop icons to arrange layout.</p>
            <p class="settings-info">Right-click to add shortcut or folder.</p>
          </section>
        </div>
      </div>
    </div>
  </div>
```

---

## 2. `styles.css` — Add these styles (append near existing settings styles ~line 1910)

### Update panel width
```css
#settings-panel {
  width: 520px;  /* was 300px */
}
```

### New sidebar + content layout
```css
#settings-body {
  flex-direction: row;
  padding: 0;
  gap: 0;
  overflow: hidden;
}

#settings-sidebar {
  width: 180px;
  min-width: 180px;
  background: rgba(0, 0, 0, 0.15);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  gap: 2px;
  overflow-y: auto;
}

#settings-search {
  margin: 0 10px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text-primary);
  font-size: 12px;
  transition: border-color var(--transition);
}

#settings-search:focus {
  border-color: var(--accent);
  outline: none;
}

#settings-search::placeholder {
  color: var(--text-muted);
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
  border-left: 2px solid transparent;
}

.settings-nav-item svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2;
  flex-shrink: 0;
}

.settings-nav-item:hover {
  background: var(--glass-hover);
  color: var(--text-primary);
}

.settings-nav-item.active {
  background: rgba(124, 106, 247, 0.12);
  color: var(--accent);
  border-left-color: var(--accent);
}

.settings-nav-item.hidden {
  display: none;
}

#settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-content-panel {
  display: none;
  flex-direction: column;
  gap: 20px;
}

.settings-content-panel.active {
  display: flex;
}
```

---

## 3. `js/app.js` — Add two methods and call them from `_wireEvents()`

### Add these methods to the `CanopyApp` class (before `_wireKeyboardShortcuts`):

```js
  /** @private */
  _initSettingsNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        this._showSettingsSection(section);
      });
    });
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
```

### Update `_closeSettingsPanel()` — add reset to default tab:

After the line `panel.classList.add('hidden');` (inside the animationend handler), add:
```js
this._showSettingsSection('appearance');
```

### Update `_wireEvents()` — add these two calls at the end (before closing brace):

```js
    this._initSettingsNavigation();
    this._initSettingsSearch();
```

---

## Verification checklist after applying

1. Reload extension in Chrome → open new tab
2. Click settings gear → panel opens at 520px wide with sidebar
3. "Appearance" is selected by default, shows wallpaper + Wallhaven
4. Click each sidebar item → correct section appears
5. Type in search box → sidebar items filter, single match auto-selects
6. Clear search → all items reappear
7. Click outside panel → closes, reopens to "Appearance"
8. Press Escape → closes panel
9. All existing functionality still works (wallpaper presets, upload, music, pomodoro, weather, data export/import/reset, Wallhaven button)
10. Lucide icons render in sidebar (call `lucide.createIcons()` on sidebar after DOM update — see note below)

### Important: Lucide icons in sidebar

The sidebar nav items contain `<i data-lucide="...">` elements. After the settings panel HTML is restructured, these need to be rendered. Add this line in `_wireEvents()` after the existing `lucide.createIcons()` call, or better — add it in `_initSettingsNavigation()`:

```js
if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.getElementById('settings-sidebar')] });
```
