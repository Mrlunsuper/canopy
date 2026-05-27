import { AMBIENT_CONFIG_KEY, toast } from './utils.js';

const DEFAULT_INDEX_URL = 'https://r2-music-api.larx-update.workers.dev/api/ambient';
const MAX_SOUNDS = 24;

export class AmbientSoundMixer {
  constructor() {
    this.player       = document.getElementById('ambient-player');
    this.pill         = document.getElementById('ambient-pill');
    this.toggleBtn    = document.getElementById('ambient-toggle');
    this.expandBtn    = document.getElementById('ambient-expand');
    this.label        = document.getElementById('ambient-label');
    this.countEl      = document.getElementById('ambient-count');
    this.statusEl     = document.getElementById('ambient-status');
    this.masterSlider = document.getElementById('ambient-master-volume');
    this.soundList    = document.getElementById('ambient-sound-list');
    this.settingsList = document.getElementById('ambient-settings-list');
    this.indexInput   = document.getElementById('ambient-index-url');
    this.syncBtn      = document.getElementById('ambient-sync-btn');
    this.resetBtn     = document.getElementById('ambient-reset');

    this.config = this._defaults();
    this.audios = new Map();
    this._dragState = null;
    this._resizeState = null;
    this._volumeSaveTimer = null;
  }

  async init() {
    await this._loadConfig();
    this._applyPosition();
    this._applySize();
    this._render();
    this._renderSettings();
    this._initResize();
    this._wireEvents();
    this._checkVisibility();
  }

  toggle() {
    if (this.config.playing) {
      this._pauseAll();
      return;
    }

    if (this.config.sounds.length > 0 && this.config.activeIds.length === 0) {
      this.config.activeIds = [this.config.sounds[0].id];
    }

    this._playActive();
  }

  toggleSound(id) {
    const active = this.config.activeIds.includes(id);
    if (active) {
      this.config.activeIds = this.config.activeIds.filter(soundId => soundId !== id);
      this._pauseSound(id);
    } else {
      this.config.activeIds.push(id);
      if (!this.config.playing) this.config.playing = true;
      if (this.config.playing) {
        this._playSound(id).catch(e => {
          console.warn('Ambient playback failed:', e);
          toast('Ambient playback failed', 'error');
        });
      }
    }

    if (this.config.activeIds.length === 0) this.config.playing = false;
    this._saveConfig();
    this._render();
    this._renderSettings();
  }

  setMasterVolume(value) {
    this.config.masterVolume = this._clampVolume(value, 70);
    this.masterSlider.value = this.config.masterVolume;
    this._updateVolumes();
    this._queueSaveConfig();
  }

  setSoundVolume(id, value) {
    this.config.volumes[id] = this._clampVolume(value, 50);
    this._updateVolumes();
    this._queueSaveConfig();
  }

  async syncFromR2() {
    if (this.indexInput) {
      const nextUrl = this.indexInput.value.trim();
      if (nextUrl) this.config.indexUrl = nextUrl;
    }

    this.syncBtn.disabled = true;
    this.syncBtn.innerHTML = '<i data-lucide="loader"></i> Syncing...';
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.syncBtn] });

    try {
      const data = await this._fetchViaWorker(this.config.indexUrl);
      const sounds = this._normalizeSounds(data);
      if (sounds.length === 0) throw new Error('No valid sounds found');

      const validIds = new Set(sounds.map(sound => sound.id));
      const nextVolumes = {};
      sounds.forEach(sound => {
        nextVolumes[sound.id] = this.config.volumes[sound.id] ?? sound.defaultVolume;
      });

      for (const [id, audio] of this.audios) {
        if (!validIds.has(id)) {
          audio.pause();
          audio.removeAttribute('src');
          this.audios.delete(id);
        }
      }

      this.config.sounds = sounds;
      this.config.volumes = nextVolumes;
      this.config.activeIds = this.config.activeIds.filter(id => validIds.has(id));
      if (this.config.activeIds.length === 0) this.config.playing = false;

      this._saveConfig();
      this._render();
      this._renderSettings();
      this._checkVisibility();
      if (this.config.playing) this._playActive();
      toast(`Synced ${sounds.length} ambient sounds`, 'success');
    } catch (e) {
      console.error('Ambient sync failed:', e);
      toast(`Ambient sync failed: ${e.message}`, 'error');
    } finally {
      this.syncBtn.disabled = false;
      this.syncBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Sync from R2';
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.syncBtn] });
    }
  }

  reset() {
    this._pauseAll();
    for (const audio of this.audios.values()) {
      audio.removeAttribute('src');
    }
    this.audios.clear();
    this.config = {
      ...this._defaults(),
      position: this.config.position,
      width: this.config.width,
      indexUrl: this.config.indexUrl || DEFAULT_INDEX_URL,
    };
    this._saveConfig();
    this._render();
    this._renderSettings();
    this._checkVisibility();
    toast('Ambient sounds cleared', 'info');
  }

  _defaults() {
    return {
      indexUrl: DEFAULT_INDEX_URL,
      masterVolume: 70,
      sounds: [],
      activeIds: [],
      volumes: {},
      position: null,
      width: null,
      expanded: false,
      playing: false,
    };
  }

  _loadConfig() {
    const apply = raw => {
      try {
        if (raw) this.config = { ...this._defaults(), ...JSON.parse(raw) };
      } catch {}

      this.config.playing = false;
      this.config.indexUrl = this._safeHttpsUrl(this.config.indexUrl) || DEFAULT_INDEX_URL;
      this.config.masterVolume = this._clampVolume(this.config.masterVolume, 70);
      this.config.sounds = this._normalizeSounds(this.config.sounds);

      const validIds = new Set(this.config.sounds.map(sound => sound.id));
      this.config.activeIds = Array.isArray(this.config.activeIds)
        ? [...new Set(this.config.activeIds)].filter(id => validIds.has(id))
        : [];

      const volumes = {};
      this.config.sounds.forEach(sound => {
        volumes[sound.id] = this._clampVolume(this.config.volumes?.[sound.id], sound.defaultVolume);
      });
      this.config.volumes = volumes;

      if (typeof this.config.width !== 'number') this.config.width = null;
      if (this.config.width !== null) this.config.width = Math.max(280, Math.min(520, this.config.width));
      this.config.expanded = this.config.expanded === true;
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise(resolve => {
        try {
          chrome.storage.local.get([AMBIENT_CONFIG_KEY], result => {
            apply(result[AMBIENT_CONFIG_KEY]);
            resolve();
          });
        } catch {
          try { apply(localStorage.getItem(AMBIENT_CONFIG_KEY)); } catch { apply(null); }
          resolve();
        }
      });
    }

    try { apply(localStorage.getItem(AMBIENT_CONFIG_KEY)); } catch { apply(null); }
    return Promise.resolve();
  }

  _saveConfig() {
    if (this._volumeSaveTimer) {
      clearTimeout(this._volumeSaveTimer);
      this._volumeSaveTimer = null;
    }

    const data = {
      indexUrl: this.config.indexUrl,
      masterVolume: this.config.masterVolume,
      sounds: this.config.sounds,
      activeIds: this.config.activeIds,
      volumes: this.config.volumes,
      position: this.config.position,
      width: this.config.width,
      expanded: this.config.expanded,
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        chrome.storage.local.set({ [AMBIENT_CONFIG_KEY]: JSON.stringify(data) });
        return;
      } catch {}
    }

    try { localStorage.setItem(AMBIENT_CONFIG_KEY, JSON.stringify(data)); } catch {}
  }

  _queueSaveConfig() {
    if (this._volumeSaveTimer) clearTimeout(this._volumeSaveTimer);
    this._volumeSaveTimer = setTimeout(() => {
      this._volumeSaveTimer = null;
      this._saveConfig();
    }, 300);
  }

  _applyPosition() {
    if (this.config.position) {
      this.player.style.left = this.config.position.x + 'px';
      this.player.style.top = this.config.position.y + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    }
  }

  _applySize() {
    const isCardLayout = document.getElementById('desktop')?.classList.contains('widget-layout-vertical');
    this.pill.style.width = isCardLayout && this.config.width ? `${this.config.width}px` : '';
  }

  _initResize() {
    const handle = document.createElement('div');
    handle.className = 'widget-resize-handle';
    handle.title = 'Drag to resize';
    this.pill.appendChild(handle);

    handle.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!document.getElementById('desktop')?.classList.contains('widget-layout-vertical')) return;
      const rect = this.player.getBoundingClientRect();
      const desktopRect = document.getElementById('desktop').getBoundingClientRect();
      this.player.style.left = (rect.left - desktopRect.left) + 'px';
      this.player.style.top = (rect.top - desktopRect.top) + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
      this.config.position = {
        x: parseInt(this.player.style.left, 10),
        y: parseInt(this.player.style.top, 10),
      };
      this._resizeState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startWidth: this.pill.getBoundingClientRect().width,
      };
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });

    const move = e => {
      if (!this._resizeState || e.pointerId !== this._resizeState.pointerId) return;
      this.config.width = Math.max(280, Math.min(520, this._resizeState.startWidth + (e.clientX - this._resizeState.startX)));
      this._applySize();
    };

    const end = e => {
      if (!this._resizeState || e.pointerId !== this._resizeState.pointerId) return;
      this.config.width = Math.round(this.config.width || this._resizeState.startWidth);
      this._saveConfig();
      try { handle.releasePointerCapture?.(this._resizeState.pointerId); } catch {}
      this._resizeState = null;
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  _wireEvents() {
    this.toggleBtn.addEventListener('click', e => { e.stopPropagation(); this.toggle(); });
    this.expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.config.expanded = !this.config.expanded;
      this._saveConfig();
      this._render();
    });

    this.masterSlider.addEventListener('input', e => this.setMasterVolume(e.target.value));
    this.syncBtn.addEventListener('click', () => this.syncFromR2());
    this.resetBtn.addEventListener('click', () => this.reset());
    this.indexInput.addEventListener('change', () => {
      const nextUrl = this._safeHttpsUrl(this.indexInput.value.trim());
      if (!nextUrl) {
        this.indexInput.value = this.config.indexUrl;
        toast('Ambient index must be an HTTPS URL', 'error');
        return;
      }
      this.config.indexUrl = nextUrl;
      this._saveConfig();
    });

    this.pill.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('#ambient-sound-list')) return;
      const rect = this.player.getBoundingClientRect();
      this._dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false,
      };
      this.pill.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    document.addEventListener('pointermove', e => {
      if (!this._dragState || e.pointerId !== this._dragState.pointerId) return;
      const dx = Math.abs(e.clientX - this._dragState.startX);
      const dy = Math.abs(e.clientY - this._dragState.startY);
      if (dx > 3 || dy > 3) this._dragState.moved = true;
      if (!this._dragState.moved) return;
      this.player.style.left = (e.clientX - this._dragState.offsetX) + 'px';
      this.player.style.top = (e.clientY - this._dragState.offsetY) + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    });

    const endDrag = e => {
      if (!this._dragState || e.pointerId !== this._dragState.pointerId) return;
      if (this._dragState.moved) {
        this.config.position = {
          x: parseInt(this.player.style.left, 10),
          y: parseInt(this.player.style.top, 10),
        };
        this._saveConfig();
      }
      try { this.pill.releasePointerCapture?.(this._dragState.pointerId); } catch {}
      this._dragState = null;
    };

    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
    window.addEventListener('pagehide', () => this._saveConfig());
  }

  _render() {
    const activeCount = this.config.activeIds.length;
    this.label.textContent = 'Ambient';
    this.countEl.textContent = String(activeCount);
    this.statusEl.textContent = this.config.sounds.length === 0
      ? 'Sync sounds'
      : activeCount === 0
        ? 'Choose sounds'
        : `${activeCount} active`;
    this.masterSlider.value = this.config.masterVolume;

    this.toggleBtn.innerHTML = this.config.playing
      ? '<i data-lucide="pause"></i>'
      : '<i data-lucide="play"></i>';
    this.toggleBtn.title = this.config.playing ? 'Pause ambient sounds' : 'Play ambient sounds';
    this.expandBtn.innerHTML = this.config.expanded
      ? '<i data-lucide="chevron-down"></i>'
      : '<i data-lucide="sliders-horizontal"></i>';
    this.expandBtn.title = this.config.expanded ? 'Hide mixer' : 'Show mixer';
    this.player.classList.toggle('playing', this.config.playing);
    this.player.classList.toggle('expanded', this.config.expanded);

    this._renderSoundList(this.soundList, true);

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.player] });
  }

  _renderSettings() {
    this.indexInput.value = this.config.indexUrl;
    this._renderSoundList(this.settingsList, false);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.settingsList, this.syncBtn] });
  }

  _renderSoundList(container, compact) {
    container.innerHTML = '';
    if (this.config.sounds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ambient-empty';
      empty.textContent = compact ? 'No sounds synced yet.' : 'Sync from R2 to load ambient loops.';
      container.appendChild(empty);
      return;
    }

    this.config.sounds.forEach(sound => {
      const row = document.createElement('div');
      row.className = 'ambient-sound-row';
      row.classList.toggle('active', this.config.activeIds.includes(sound.id));

      const toggle = document.createElement('button');
      toggle.className = 'ambient-sound-toggle';
      toggle.title = this.config.activeIds.includes(sound.id) ? `Stop ${sound.name}` : `Play ${sound.name}`;
      toggle.innerHTML = `<i data-lucide="${sound.icon}"></i>`;

      const name = document.createElement('span');
      name.className = 'ambient-sound-name';
      name.textContent = sound.name;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = this.config.volumes[sound.id] ?? sound.defaultVolume;
      slider.className = 'ambient-volume';
      slider.title = `${sound.name} volume`;

      row.appendChild(toggle);
      row.appendChild(name);
      row.appendChild(slider);
      container.appendChild(row);

      toggle.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleSound(sound.id);
      });
      slider.addEventListener('input', e => this.setSoundVolume(sound.id, e.target.value));
    });
  }

  _playActive() {
    if (this.config.activeIds.length === 0) return;
    this.config.playing = true;
    this._updateVolumes();
    const plays = this.config.activeIds.map(id => this._playSound(id));
    Promise.allSettled(plays).then(results => {
      if (results.every(result => result.status === 'rejected')) {
        this.config.playing = false;
        this._render();
        toast('Ambient playback failed', 'error');
      }
    });
    this._saveConfig();
    this._render();
  }

  _playSound(id) {
    const sound = this.config.sounds.find(item => item.id === id);
    if (!sound) return Promise.reject(new Error('Unknown sound'));
    const audio = this._getAudio(sound);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this._volumeFor(sound.id);
    return audio.play();
  }

  _pauseSound(id) {
    const audio = this.audios.get(id);
    if (audio) audio.pause();
  }

  _pauseAll() {
    this.config.playing = false;
    for (const audio of this.audios.values()) audio.pause();
    this._saveConfig();
    this._render();
  }

  _getAudio(sound) {
    let audio = this.audios.get(sound.id);
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.addEventListener('error', () => toast(`${sound.name} unavailable`, 'error'));
      this.audios.set(sound.id, audio);
    }
    if (audio.src !== sound.url) audio.src = sound.url;
    return audio;
  }

  _updateVolumes() {
    this.config.sounds.forEach(sound => {
      const audio = this.audios.get(sound.id);
      if (audio) audio.volume = this._volumeFor(sound.id);
    });
  }

  _volumeFor(id) {
    const soundVolume = this._clampVolume(this.config.volumes[id], 50) / 100;
    const masterVolume = this.config.masterVolume / 100;
    return Math.max(0, Math.min(1, soundVolume * masterVolume));
  }

  _normalizeSounds(data) {
    const source = Array.isArray(data) ? data : Array.isArray(data?.sounds) ? data.sounds : [];
    const seen = new Set();
    return source.slice(0, MAX_SOUNDS).map((item, index) => {
      const fileKey = (item.key || item.name || '').toString().trim();
      const rawId = (item.id || fileKey || `sound-${index + 1}`).toString().trim().toLowerCase();
      const id = rawId
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `sound-${index + 1}`;
      const name = (item.title || this._labelFromFileName(item.name || fileKey || id)).toString().trim().slice(0, 80);
      const url = this._safeHttpsUrl(item.url || item.streamUrl || item.src);
      const icon = /^[a-z0-9-]{1,50}$/i.test(item.icon || '') ? item.icon : this._inferIcon(id);
      if (!name || !url || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name,
        icon,
        url,
        defaultVolume: this._clampVolume(item.defaultVolume ?? item.volume, 50),
      };
    }).filter(Boolean);
  }

  _labelFromFileName(value) {
    const base = value.toString().trim().split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    return base
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Ambient Sound';
  }

  _inferIcon(id) {
    if (/rain|drizzle|storm/.test(id)) return 'cloud-rain';
    if (/thunder/.test(id)) return 'cloud-lightning';
    if (/wind/.test(id)) return 'wind';
    if (/wave|ocean|sea|river|stream/.test(id)) return 'waves';
    if (/fire|flame|campfire/.test(id)) return 'flame';
    if (/bird|forest/.test(id)) return 'bird';
    if (/coffee|cafe/.test(id)) return 'coffee';
    return 'waves';
  }

  _safeHttpsUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return null;
    try {
      const url = new URL(rawUrl.trim());
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  _clampVolume(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
  }

  _fetchViaWorker(url) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        this._fetchDirect(url).then(resolve).catch(reject);
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'ambient-sync', url },
        response => {
          if (chrome.runtime.lastError) {
            this._fetchDirect(url).then(resolve).catch(() => {
              reject(new Error(chrome.runtime.lastError.message));
            });
          } else if (!response?.ok) {
            reject(new Error(response?.error || 'No response from background worker'));
          } else {
            resolve(response.data);
          }
        }
      );
    });
  }

  async _fetchDirect(url) {
    const safeUrl = this._safeHttpsUrl(url);
    if (!safeUrl) throw new Error('Ambient index must be an HTTPS URL');

    const res = await fetch(safeUrl, { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  _checkVisibility() {
    this.player.classList.toggle('hidden', this.config.sounds.length === 0);
  }
}
