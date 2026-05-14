import { MUSIC_CONFIG_KEY, toast } from './utils.js';

export class MusicPlayer {
  constructor() {
    this.player       = document.getElementById('music-player');
    this.pill         = document.getElementById('music-pill');
    this.toggleBtn    = document.getElementById('music-toggle');
    this.prev         = document.getElementById('music-prev');
    this.next         = document.getElementById('music-next');
    this.label        = document.getElementById('music-track-label');
    this.timeDisplay  = document.getElementById('music-time');
    this.slider       = document.getElementById('music-volume');
    this.shuffleBtn   = document.getElementById('music-shuffle');
    this.repeatBtn    = document.getElementById('music-repeat');
    this.progressBar  = document.getElementById('music-progress');
    this.progressFill = document.getElementById('music-progress-fill');
    this.trackList    = document.getElementById('music-track-list');
    this.newName      = document.getElementById('music-new-name');
    this.newUrl       = document.getElementById('music-new-url');
    this.addBtn       = document.getElementById('music-add-btn');
    this.resetBtn     = document.getElementById('music-reset-defaults');
    this.r2Url        = document.getElementById('music-r2-url');
    this.syncBtn      = document.getElementById('music-sync-btn');
    this.collapseBtn  = document.getElementById('music-collapse');

    this.config = this._defaults();
    this.audio  = document.getElementById('music-audio');
    this._seekDragging = false;
    this._dragState = null;
  }

  init() {
    this.audio.preload = 'auto';
    this._loadConfig();
    this._applyPosition();
    this._applyTrack();
    this._updateProgressDisplay();
    this._renderPlayer();
    this._renderSettingsList();
    this._wireEvents();
    this._wireAudioEvents();
    this._checkVisibility();
  }

  // ═══════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════

  toggle() {
    if (this.config.tracks.length === 0) return;
    if (this.audio.paused) {
      const track = this.config.tracks[this.config.currentIndex];
      if (track && !this.audio.src) {
        this._applyTrack();
      }
      this.audio.play().catch(e => {
        console.error('Play failed:', e);
      });
    } else {
      this.audio.pause();
    }
  }

  prevTrack() {
    if (this.config.tracks.length === 0) return;
    const wasPlaying = !this.audio.paused;
    if (this.config.tracks.length === 1) {
      this.audio.currentTime = 0;
      if (wasPlaying) this.audio.play().catch(() => {});
      this._renderPlayer();
      return;
    }
    if (this.config.shuffle) {
      this._shufflePrev();
    } else {
      this.config.currentIndex = (this.config.currentIndex - 1 + this.config.tracks.length) % this.config.tracks.length;
    }
    this._applyTrack();
    this._saveConfig();
    this._renderPlayer();
    if (wasPlaying) {
      this.audio.play().catch(() => {});
    }
  }

  nextTrack() {
    if (this.config.tracks.length === 0) return;
    const wasPlaying = !this.audio.paused;
    if (this.config.tracks.length === 1) {
      this.audio.currentTime = 0;
      if (wasPlaying) this.audio.play().catch(() => {});
      this._renderPlayer();
      return;
    }
    if (this.config.shuffle) {
      this._shuffleAdvance();
    } else {
      this.config.currentIndex = (this.config.currentIndex + 1) % this.config.tracks.length;
    }
    this._applyTrack();
    this._saveConfig();
    this._renderPlayer();
    if (wasPlaying) {
      this.audio.play().catch(() => {});
    }
  }

  setVolume(value) {
    const v = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    this.config.volume = v;
    this.audio.volume = v / 100;
    this.slider.value = v;
    this._saveConfig();
  }

  seekTo(percent) {
    if (!isFinite(this.audio.duration)) return;
    const time = (percent / 100) * this.audio.duration;
    this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration));
    this._updateProgressDisplay();
  }

  toggleShuffle() {
    this.config.shuffle = !this.config.shuffle;
    if (this.config.shuffle) {
      this._generateShuffleOrder();
    }
    this._saveConfig();
    this._renderPlayer();
  }

  cycleRepeat() {
    this.config.repeat = (this.config.repeat + 1) % 3;
    this._saveConfig();
    this._renderPlayer();
  }

  toggleCollapsed() {
    this.config.collapsed = !this.config.collapsed;
    this._saveConfig();
    this._renderPlayer();
  }

  addTrack(name, url) {
    name = name.trim();
    url = url.trim();
    if (!name || !url) return;
    this.config.tracks.push({ name, url });
    if (this.config.tracks.length === 1) {
      this.config.currentIndex = 0;
      this._applyTrack();
      this._renderPlayer();
    }
    if (this.config.shuffle) this._generateShuffleOrder();
    this._saveConfig();
    this._renderSettingsList();
    this._checkVisibility();
  }

  editTrack(index, name, url) {
    name = name.trim();
    url = url.trim();
    if (!name || !url) return;
    this.config.tracks[index] = { name, url };
    if (this.config.currentIndex === index) {
      this._applyTrack();
      this._renderPlayer();
    }
    this._saveConfig();
    this._renderSettingsList();
  }

  deleteTrack(index) {
    const wasPlaying = !this.audio.paused;
    const wasActive = this.config.currentIndex === index;
    this.audio.pause();
    this.config.tracks.splice(index, 1);
    if (wasActive && this.config.tracks.length > 0) {
      this.config.currentIndex = Math.min(index, this.config.tracks.length - 1);
      this._applyTrack();
      if (wasPlaying) {
        this.audio.play().catch(() => {});
      }
    } else if (wasActive) {
      this.config.currentIndex = 0;
      this._applyTrack();
    } else if (this.config.currentIndex > index) {
      this.config.currentIndex--;
    }
    if (this.config.shuffle) this._generateShuffleOrder();
    this._saveConfig();
    this._renderPlayer();
    this._renderSettingsList();
    this._checkVisibility();
  }

  resetDefaults() {
    const wasPlaying = !this.audio.paused;
    this.audio.pause();
    const defaults = this._defaults();
    this.config.tracks = defaults.tracks;
    this.config.currentIndex = defaults.currentIndex;
    this.config.r2BaseUrl = defaults.r2BaseUrl;
    this.config.shuffle = defaults.shuffle;
    this.config.repeat = defaults.repeat;
    this.config.shuffleOrder = [];
    this.config.shufflePos = 0;
    this._applyTrack();
    if (wasPlaying) {
      this.audio.play().catch(() => {});
    }
    this._saveConfig();
    this._renderPlayer();
    this._renderSettingsList();
    this._checkVisibility();
    toast('Music tracks reset to defaults', 'info');
  }

  // ═══════════════════════════════════════════════
  //  PERSISTENCE
  // ═══════════════════════════════════════════════

  _defaults() {
    return {
      currentIndex: 0,
      volume: 75,
      r2BaseUrl: '',
      tracks: [],
      shuffle: false,
      repeat: 0,
      shuffleOrder: [],
      shufflePos: 0,
      position: null,
      collapsed: false
    };
  }

  _applyPosition() {
    if (this.config.position) {
      this.player.style.left = this.config.position.x + 'px';
      this.player.style.top = this.config.position.y + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    }
  }

  _loadConfig() {
    try {
      const raw = localStorage.getItem(MUSIC_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.config = { ...this._defaults(), ...parsed, tracks: parsed.tracks || [] };
      }
    } catch {}

    if (typeof this.config.currentIndex !== 'number' ||
        this.config.currentIndex < 0 ||
        this.config.currentIndex >= this.config.tracks.length) {
      this.config.currentIndex = 0;
    }
    if (typeof this.config.volume !== 'number') this.config.volume = 75;
    if (typeof this.config.r2BaseUrl !== 'string') this.config.r2BaseUrl = '';
    if (typeof this.config.shuffle !== 'boolean') this.config.shuffle = false;
    if (typeof this.config.repeat !== 'number' || this.config.repeat < 0 || this.config.repeat > 2) this.config.repeat = 0;
    if (typeof this.config.collapsed !== 'boolean') this.config.collapsed = false;
    this.config.volume = Math.max(0, Math.min(100, this.config.volume));
    this.audio.volume = this.config.volume / 100;
    this.r2Url.value = this.config.r2BaseUrl;

    if (this.config.shuffle && this.config.tracks.length > 1) {
      if (!Array.isArray(this.config.shuffleOrder) ||
          this.config.shuffleOrder.length !== this.config.tracks.length) {
        this._generateShuffleOrder();
      }
      if (typeof this.config.shufflePos !== 'number' ||
          this.config.shufflePos >= this.config.shuffleOrder.length) {
        this.config.shufflePos = 0;
      }
    }
  }

  _saveConfig() {
    try {
      localStorage.setItem(MUSIC_CONFIG_KEY, JSON.stringify({
        currentIndex: this.config.currentIndex,
        volume: this.config.volume,
        r2BaseUrl: this.config.r2BaseUrl,
        tracks: this.config.tracks,
        shuffle: this.config.shuffle,
        repeat: this.config.repeat,
        shuffleOrder: this.config.shuffleOrder,
        shufflePos: this.config.shufflePos,
        position: this.config.position,
        collapsed: this.config.collapsed
      }));
    } catch {}
  }

  // ═══════════════════════════════════════════════
  //  TRACK SWITCHING
  // ═══════════════════════════════════════════════

  _resolveUrl(url) {
    if (/^https?:\/\//.test(url)) return url;
    const base = (this.config.r2BaseUrl || '').replace(/\/+$/, '');
    const path = url.replace(/^\/+/, '');
    return base ? `${base}/${path}` : url;
  }

  _applyTrack() {
    const idx = this.config.currentIndex;
    if (idx >= 0 && idx < this.config.tracks.length) {
      this.audio.src = this._resolveUrl(this.config.tracks[idx].url);
    }
  }

  // ═══════════════════════════════════════════════
  //  SHUFFLE
  // ═══════════════════════════════════════════════

  _generateShuffleOrder() {
    const n = this.config.tracks.length;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (n > 1 && order[0] === this.config.currentIndex) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    this.config.shuffleOrder = order;
    this.config.shufflePos = 0;
  }

  _shuffleAdvance() {
    const order = this.config.shuffleOrder;
    let pos = this.config.shufflePos + 1;
    if (pos >= order.length) {
      if (this.config.repeat === 1) {
        this._generateShuffleOrder();
        pos = 0;
      } else {
        return;
      }
    }
    this.config.shufflePos = pos;
    this.config.currentIndex = this.config.shuffleOrder[pos];
  }

  _shufflePrev() {
    const order = this.config.shuffleOrder;
    let pos = this.config.shufflePos - 1;
    if (pos < 0) {
      pos = order.length - 1;
    }
    this.config.shufflePos = pos;
    this.config.currentIndex = order[pos];
  }

  // ═══════════════════════════════════════════════
  //  PROGRESS / TIME
  // ═══════════════════════════════════════════════

  _formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}:${String(rm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  _updateProgressDisplay() {
    const duration = this.audio.duration;
    const current = this.audio.currentTime;
    const pct = (duration && isFinite(duration)) ? (current / duration) * 100 : 0;
    this.progressFill.style.width = `${pct}%`;
    this.timeDisplay.textContent =
      `${this._formatTime(current)} / ${this._formatTime(duration)}`;
  }

  // ═══════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════

  _renderPlayer() {
    const track = this.config.tracks[this.config.currentIndex];
    this.label.textContent = track ? track.name : '';
    this.slider.value = this.config.volume;

    this.toggleBtn.innerHTML = this.audio.paused
      ? '<i data-lucide="play"></i>'
      : '<i data-lucide="pause"></i>';
    this.player.classList.toggle('playing', !this.audio.paused);

    this.player.classList.toggle('collapsed', this.config.collapsed);
    this.collapseBtn.innerHTML = this.config.collapsed
      ? '<i data-lucide="chevron-up"></i>'
      : '<i data-lucide="chevron-down"></i>';
    this.collapseBtn.title = this.config.collapsed ? 'Expand' : 'Collapse';

    this.shuffleBtn.classList.toggle('active', this.config.shuffle);
    this.shuffleBtn.title = this.config.shuffle ? 'Shuffle on' : 'Shuffle off';

    this.repeatBtn.classList.remove('active', 'repeat-one');
    if (this.config.repeat === 1) {
      this.repeatBtn.classList.add('active');
      this.repeatBtn.innerHTML = '<i data-lucide="repeat"></i>';
      this.repeatBtn.title = 'Repeat all';
    } else if (this.config.repeat === 2) {
      this.repeatBtn.classList.add('active', 'repeat-one');
      this.repeatBtn.innerHTML = '<i data-lucide="repeat-1"></i>';
      this.repeatBtn.title = 'Repeat one';
    } else {
      this.repeatBtn.innerHTML = '<i data-lucide="repeat"></i>';
      this.repeatBtn.title = 'Repeat off';
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [this.toggleBtn, this.shuffleBtn, this.repeatBtn, this.collapseBtn] });
    }
  }

  _renderSettingsList() {
    this.trackList.innerHTML = '';
    this.config.tracks.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = 'music-track-row';
      row.dataset.index = i;

      const isActive = i === this.config.currentIndex;
      const nameEl = document.createElement('span');
      nameEl.className = 'track-name' + (isActive ? ' active' : '');
      nameEl.textContent = track.name;

      const urlEl = document.createElement('span');
      urlEl.className = 'track-url';
      urlEl.textContent = this._resolveUrl(track.url);

      const info = document.createElement('div');
      info.className = 'track-info';
      info.appendChild(nameEl);
      info.appendChild(urlEl);

      const editBtn = document.createElement('button');
      editBtn.className = 'track-edit-btn';
      editBtn.innerHTML = '<i data-lucide="pencil"></i>';
      editBtn.title = 'Edit';

      const delBtn = document.createElement('button');
      delBtn.className = 'track-delete-btn';
      delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      delBtn.title = 'Delete';

      const actions = document.createElement('div');
      actions.className = 'track-actions';
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      row.appendChild(info);
      row.appendChild(actions);
      this.trackList.appendChild(row);

      delBtn.addEventListener('click', () => {
        this.deleteTrack(i);
      });

      editBtn.addEventListener('click', () => {
        const editing = row.classList.toggle('editing');
        if (editing) {
          nameEl.contentEditable = 'true';
          urlEl.contentEditable = 'true';
          nameEl.classList.add('editable');
          urlEl.classList.add('editable');
          editBtn.innerHTML = '<i data-lucide="check"></i>';
          editBtn.title = 'Save';
          nameEl.focus();
        } else {
          nameEl.contentEditable = 'false';
          urlEl.contentEditable = 'false';
          nameEl.classList.remove('editable');
          urlEl.classList.remove('editable');
          editBtn.innerHTML = '<i data-lucide="pencil"></i>';
          editBtn.title = 'Edit';
          this.editTrack(i, nameEl.textContent, urlEl.textContent);
        }
      });

      info.addEventListener('click', () => {
        if (row.classList.contains('editing')) return;
        if (this.config.currentIndex === i) return;
        const wasPlaying = !this.audio.paused;
        this.audio.pause();
        this.config.currentIndex = i;
        if (this.config.shuffle) {
          const orderIdx = this.config.shuffleOrder.indexOf(i);
          if (orderIdx !== -1) this.config.shufflePos = orderIdx;
        }
        this._applyTrack();
        if (wasPlaying) {
          this.audio.play().catch(() => {});
        }
        this._saveConfig();
        this._renderPlayer();
        this._renderSettingsList();
      });

      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [row] });
    });
  }

  _checkVisibility() {
    this.player.classList.toggle('hidden', this.config.tracks.length === 0);
  }

  // ═══════════════════════════════════════════════
  //  ENDED HANDLER
  // ═══════════════════════════════════════════════

  _handleEnded() {
    if (this.config.repeat === 2) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
      return;
    }

    if (this.config.shuffle && this.config.tracks.length > 1) {
      const order = this.config.shuffleOrder;
      const nextPos = this.config.shufflePos + 1;
      if (nextPos >= order.length && this.config.repeat !== 1) {
        this._renderPlayer();
        return;
      }
      this._shuffleAdvance();
      this._applyTrack();
      this._saveConfig();
      this._renderPlayer();
      this.audio.play().catch(() => {});
      return;
    }

    if (this.config.currentIndex < this.config.tracks.length - 1) {
      this.config.currentIndex++;
      this._applyTrack();
      this._saveConfig();
      this._renderPlayer();
      this.audio.play().catch(() => {});
    } else if (this.config.repeat === 1) {
      this.config.currentIndex = 0;
      this._applyTrack();
      this._saveConfig();
      this._renderPlayer();
      this.audio.play().catch(() => {});
    } else {
      this._renderPlayer();
    }
  }

  // ═══════════════════════════════════════════════
  //  EVENT WIRING
  // ═══════════════════════════════════════════════

  _wireEvents() {
    this.toggleBtn.addEventListener('click', e => { e.stopPropagation(); this.toggle(); });
    this.prev.addEventListener('click', e => { e.stopPropagation(); this.prevTrack(); });
    this.next.addEventListener('click', e => { e.stopPropagation(); this.nextTrack(); });
    this.shuffleBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleShuffle(); });
    this.repeatBtn.addEventListener('click', e => { e.stopPropagation(); this.cycleRepeat(); });
    this.collapseBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleCollapsed(); });

    // Drag to reposition
    this.pill.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('#music-progress')) return;
      const rect = this.player.getBoundingClientRect();
      this._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false
      };
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!this._dragState) return;
      const dx = Math.abs(e.clientX - this._dragState.startX);
      const dy = Math.abs(e.clientY - this._dragState.startY);
      if (dx > 3 || dy > 3) this._dragState.moved = true;
      if (!this._dragState.moved) return;
      this.player.style.left = (e.clientX - this._dragState.offsetX) + 'px';
      this.player.style.top = (e.clientY - this._dragState.offsetY) + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!this._dragState) return;
      if (this._dragState.moved) {
        this.config.position = {
          x: parseInt(this.player.style.left, 10),
          y: parseInt(this.player.style.top, 10)
        };
        this._saveConfig();
        this._dragJustHappened = true;
        setTimeout(() => { this._dragJustHappened = false; }, 100);
      }
      this._dragState = null;
    });

    this.slider.addEventListener('input', e => {
      this.setVolume(e.target.value);
    });

    this.progressBar.addEventListener('click', e => {
      e.stopPropagation();
      if (!isFinite(this.audio.duration)) return;
      const rect = this.progressBar.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      this.seekTo(pct);
    });

    this.progressBar.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (!isFinite(this.audio.duration)) return;
      this._seekDragging = true;

      const onMove = (ev) => {
        if (!this._seekDragging) return;
        const rect = this.progressBar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
        this.seekTo(pct);
      };

      const onUp = () => {
        this._seekDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);

      const rect = this.progressBar.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      this.seekTo(pct);
    });

    this.addBtn.addEventListener('click', () => {
      this.addTrack(this.newName.value, this.newUrl.value);
      this.newName.value = '';
      this.newUrl.value = '';
    });

    this.resetBtn.addEventListener('click', () => this.resetDefaults());

    this.r2Url.addEventListener('change', () => {
      this.config.r2BaseUrl = this.r2Url.value.trim();
      this._saveConfig();
    });

    this.syncBtn.addEventListener('click', () => this.syncFromR2());

    [this.newName, this.newUrl].forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.addBtn.click();
      });
    });
  }

  async syncFromR2() {
    const base = this.config.r2BaseUrl || this.r2Url.value.trim();
    if (!base) {
      toast('Set your R2 bucket URL first', 'error');
      return;
    }
    this.config.r2BaseUrl = base;
    this.r2Url.value = base;
    this._saveConfig();

    this.syncBtn.disabled = true;
    this.syncBtn.innerHTML = '<i data-lucide="loader"></i> Syncing...';
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.syncBtn] });

    try {
      const cleanBase = base.replace(/\/+$/, '');
      const url = `${cleanBase}/index.json`;
      const data = await this._fetchViaWorker(url);
      if (!data.tracks || !Array.isArray(data.tracks)) {
        throw new Error('Invalid format: expected { "tracks": [...] }');
      }
      const seen = new Set();
      data.tracks.forEach(t => {
        const name = (t.name || '').trim();
        const url = (t.url || '').trim();
        if (!name || !url) return;
        const key = `${name}|${url}`;
        if (seen.has(key)) return;
        seen.add(key);
        this.config.tracks.push({ name, url });
      });
      if (this.config.shuffle) this._generateShuffleOrder();
      this._saveConfig();
      this._renderPlayer();
      this._renderSettingsList();
      this._checkVisibility();
      toast(`Synced ${seen.size} tracks from R2`, 'success');
    } catch (e) {
      console.error('R2 sync failed:', e);
      toast(`Sync failed: ${e.message}`, 'error');
    } finally {
      this.syncBtn.disabled = false;
      this.syncBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Sync from R2';
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.syncBtn] });
    }
  }

  _fetchViaWorker(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'music-sync', url },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response.ok) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      );
    });
  }

  _wireAudioEvents() {
    this.audio.addEventListener('play', () => this._renderPlayer());
    this.audio.addEventListener('pause', () => this._renderPlayer());
    this.audio.addEventListener('timeupdate', () => {
      if (!this._seekDragging) this._updateProgressDisplay();
    });
    this.audio.addEventListener('loadedmetadata', () => this._updateProgressDisplay());
    this.audio.addEventListener('ended', () => this._handleEnded());
    this.audio.addEventListener('error', () => {
      const track = this.config.tracks[this.config.currentIndex];
      toast(`${track ? track.name : 'Track'} unavailable`, 'error');
    });
  }
}
