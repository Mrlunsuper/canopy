const TODAY_PANEL_POSITION_KEY = 'canopy_today_panel_position';

export class TodayPanel {
  constructor({ clock, weather, pomodoro, audio }) {
    this.clock = clock;
    this.weather = weather;
    this.pomodoro = pomodoro;
    this.audio = audio;

    this.panel = document.getElementById('today-panel');
    this.clockSection = document.querySelector('[data-today-section="clock"]');
    this.weatherSection = document.querySelector('[data-today-section="weather"]');
    this.pomodoroSection = document.querySelector('[data-today-section="pomodoro"]');
    this.audioSection = document.querySelector('[data-today-section="audio"]');
    this.audioList = document.getElementById('today-audio-list');

    this._visibility = {};
    this._dragState = null;
    this._lastAudioListKey = '';
  }

  init(visibility = {}) {
    if (!this.panel) return;
    this._visibility = { ...visibility };
    this._restorePosition();
    this._wireEvents();
    this.render();
    this._hydrateIcons(this.panel);
  }

  setVisibility(visibility = {}) {
    this._visibility = { ...visibility };
    this.render();
  }

  render() {
    if (!this.panel) return;

    this._renderClock();
    this._renderWeather();
    this._renderPomodoro();
    this._renderAudio();

    this._toggleSection(this.clockSection, this._visibility.clock !== false);
    this._toggleSection(this.weatherSection, this._visibility.weather !== false);
    this._toggleSection(this.pomodoroSection, this._visibility.pomodoro !== false);
    this._toggleSection(this.audioSection, this._visibility.audio !== false);

  }

  _renderClock() {
    const snap = this.clock?.getSnapshot?.() || {};
    const fallback = this._clockFallback();
    this._setText('today-clock-time', snap.time || fallback.time);
    this._setText('today-clock-date', snap.date || fallback.date);
    this.panel.classList.remove('clock-morning', 'clock-afternoon', 'clock-evening', 'clock-night');
    this.panel.classList.add(snap.mood || fallback.mood);
  }

  _clockFallback() {
    const now = new Date();
    const hour = now.getHours();
    let mood = 'clock-night';
    if (hour >= 5 && hour < 12) mood = 'clock-morning';
    else if (hour >= 12 && hour < 17) mood = 'clock-afternoon';
    else if (hour >= 17 && hour < 21) mood = 'clock-evening';

    return {
      time: `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      date: now.toLocaleDateString('en-US', { weekday: 'long', month: '2-digit', day: '2-digit' }),
      mood,
    };
  }

  _renderWeather() {
    const snap = this.weather?.getSnapshot?.() || {};
    this._setText('today-weather-icon', snap.icon || '🌡️');
    this._setText('today-weather-temp', snap.temperature || '--°');
    this._setText('today-weather-desc', snap.description || 'Loading...');
    this._setText('today-weather-location', snap.location || '');
    this._setText('today-weather-updated', snap.updated || '');
    this.panel.classList.toggle('today-weather-loading', !snap.hasData);
  }

  _renderPomodoro() {
    const snap = this.pomodoro?.getSnapshot?.() || {};
    this._setText('today-pomodoro-mode', snap.label || 'Focus');
    this._setText('today-pomodoro-time', snap.time || '25:00');
    this._setText('today-pomodoro-sessions', `#${snap.sessions ?? 0}`);

    const toggle = document.getElementById('today-pomodoro-toggle');
    if (toggle) {
      this._setIcon(toggle, snap.running ? 'pause' : 'play', snap.running ? 'Pause' : 'Start');
    }

    const progress = document.getElementById('today-pomodoro-progress');
    if (progress) {
      progress.style.setProperty('--today-pomodoro-progress', `${Math.max(0, Math.min(1, snap.progress || 0)) * 100}%`);
    }

    this.panel.classList.toggle('today-pomodoro-running', Boolean(snap.running));
    this.panel.dataset.pomodoroPhase = snap.phase || 'work';
  }

  _renderAudio() {
    const snap = this.audio?.getSnapshot?.() || {};
    const modeLabel = snap.mode === 'ambient' ? 'Ambient' : 'Music';
    const title = snap.mode === 'ambient' ? (snap.ambientLabel || 'Ambient') : (snap.trackName || 'Music');
    const meta = snap.mode === 'ambient'
      ? `${snap.ambientCount || 0} active`
      : (snap.musicTime || '--:-- / --:--');
    const activeModePlaying = snap.mode === 'ambient'
      ? Boolean(snap.ambientPlaying)
      : Boolean(snap.musicPlaying);

    this._setText('today-audio-mode', modeLabel);
    this._setText('today-audio-title', title);
    this._setText('today-audio-meta', meta);

    const toggle = document.getElementById('today-audio-toggle');
    if (toggle) {
      this._setIcon(toggle, activeModePlaying ? 'pause' : 'play', activeModePlaying ? 'Pause' : 'Play');
    }

    const icon = document.getElementById('today-audio-icon');
    if (icon) this._setIcon(icon, snap.mode === 'ambient' ? 'waves' : 'music');

    const modeToggle = document.getElementById('today-audio-mode-toggle');
    if (modeToggle) {
      this._setIcon(
        modeToggle,
        snap.mode === 'ambient' ? 'music' : 'waves',
        snap.mode === 'ambient' ? 'Switch to music' : 'Switch to ambient'
      );
    }

    const prev = document.getElementById('today-audio-prev');
    const next = document.getElementById('today-audio-next');
    prev?.classList.toggle('hidden', snap.mode === 'ambient');
    next?.classList.toggle('hidden', snap.mode === 'ambient');

    const volume = document.getElementById('today-audio-volume');
    if (volume && document.activeElement !== volume) {
      volume.value = snap.mode === 'ambient'
        ? (snap.ambientMasterVolume ?? 70)
        : (snap.musicVolume ?? 75);
      volume.title = snap.mode === 'ambient' ? 'Ambient master volume' : 'Music volume';
    }

    const progress = document.getElementById('today-audio-progress');
    if (progress && document.activeElement !== progress) {
      progress.value = snap.mode === 'ambient' ? 0 : (snap.musicProgress ?? 0);
      progress.classList.toggle('hidden', snap.mode === 'ambient');
    }

    this._renderAudioList(snap);
    this.panel.classList.toggle('today-audio-playing', activeModePlaying);
  }

  _renderAudioList(snap) {
    if (!this.audioList) return;

    const key = snap.mode === 'ambient'
      ? `ambient|${(snap.ambientSounds || []).map(sound => `${sound.id}:${sound.active}:${sound.volume}:${sound.name}:${sound.icon}`).join('|')}`
      : `music|${(snap.tracks || []).map(track => `${track.index}:${track.current}:${track.name}`).join('|')}`;

    if (key === this._lastAudioListKey) return;
    this._lastAudioListKey = key;
    this.audioList.innerHTML = '';
    this.audioList.dataset.mode = snap.mode || 'music';

    if (snap.mode === 'ambient') {
      const sounds = snap.ambientSounds || [];
      if (sounds.length === 0) {
        this._renderAudioEmpty('No ambient sounds synced');
        return;
      }

      sounds.forEach(sound => {
        const row = document.createElement('div');
        row.className = 'today-audio-list-row today-ambient-row';
        row.classList.toggle('active', sound.active);
        row.dataset.soundId = sound.id;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'today-ambient-toggle';
        toggle.dataset.soundId = sound.id;
        toggle.title = sound.active ? `Stop ${sound.name}` : `Play ${sound.name}`;
        toggle.innerHTML = `<i data-lucide="${sound.icon || 'waves'}"></i>`;

        const name = document.createElement('span');
        name.className = 'today-audio-list-name';
        name.textContent = sound.name;

        const volume = document.createElement('input');
        volume.type = 'range';
        volume.min = '0';
        volume.max = '100';
        volume.value = sound.volume;
        volume.className = 'today-ambient-volume';
        volume.dataset.soundId = sound.id;
        volume.title = `${sound.name} volume`;

        row.appendChild(toggle);
        row.appendChild(name);
        row.appendChild(volume);
        this.audioList.appendChild(row);
      });

      this._hydrateIcons(this.audioList);
      return;
    }

    const tracks = snap.tracks || [];
    if (tracks.length === 0) {
      this._renderAudioEmpty('No music tracks');
      return;
    }

    tracks.forEach(track => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'today-audio-list-row today-track-row';
      item.classList.toggle('active', track.current);
      item.dataset.trackIndex = String(track.index);
      item.title = track.name;

      const index = document.createElement('span');
      index.className = 'today-track-index';
      index.textContent = String(track.index + 1).padStart(2, '0');

      const name = document.createElement('span');
      name.className = 'today-audio-list-name';
      name.textContent = track.name;

      item.appendChild(index);
      item.appendChild(name);
      this.audioList.appendChild(item);
    });
  }

  _renderAudioEmpty(message) {
    const empty = document.createElement('div');
    empty.className = 'today-audio-empty';
    empty.textContent = message;
    this.audioList.appendChild(empty);
  }

  _wireEvents() {
    this.panel.addEventListener('pointerdown', e => e.stopPropagation());

    window.addEventListener('canopy:clock-update', () => this.render());
    window.addEventListener('canopy:weather-update', () => this.render());
    window.addEventListener('canopy:pomodoro-update', () => this.render());
    window.addEventListener('canopy:audio-update', () => this.render());

    document.getElementById('today-weather-refresh')?.addEventListener('click', async e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.classList.add('spinning');
      await this.weather?.refresh?.();
      setTimeout(() => btn.classList.remove('spinning'), 600);
    });

    document.getElementById('today-weather-unit')?.addEventListener('click', e => {
      e.stopPropagation();
      this.weather?.toggleUnit?.();
    });

    document.getElementById('today-pomodoro-toggle')?.addEventListener('click', e => {
      e.stopPropagation();
      this.pomodoro?.toggle?.();
    });
    document.getElementById('today-pomodoro-skip')?.addEventListener('click', e => {
      e.stopPropagation();
      this.pomodoro?.skip?.();
    });
    document.getElementById('today-pomodoro-reset')?.addEventListener('click', e => {
      e.stopPropagation();
      this.pomodoro?.reset?.();
    });

    document.getElementById('today-audio-prev')?.addEventListener('click', e => {
      e.stopPropagation();
      this.audio?.prevTrack?.();
    });
    document.getElementById('today-audio-mode-toggle')?.addEventListener('click', e => {
      e.stopPropagation();
      this.audio?.toggleMode?.();
    });
    document.getElementById('today-audio-toggle')?.addEventListener('click', e => {
      e.stopPropagation();
      this.audio?.toggle?.();
    });
    document.getElementById('today-audio-next')?.addEventListener('click', e => {
      e.stopPropagation();
      this.audio?.nextTrack?.();
    });
    document.getElementById('today-audio-volume')?.addEventListener('input', e => {
      const mode = this.audio?.getSnapshot?.().mode;
      if (mode === 'ambient') {
        this.audio?.setAmbientMasterVolume?.(e.target.value);
      } else {
        this.audio?.setMusicVolume?.(e.target.value);
      }
    });

    document.getElementById('today-audio-progress')?.addEventListener('input', e => {
      if (this.audio?.getSnapshot?.().mode !== 'music') return;
      this.audio?.seekMusicTo?.(Number(e.target.value));
    });

    this.audioList?.addEventListener('click', e => {
      e.stopPropagation();
      const track = e.target.closest('[data-track-index]');
      if (track) {
        this.audio?.selectTrack?.(Number(track.dataset.trackIndex), true);
        return;
      }

      const sound = e.target.closest('[data-sound-id]');
      if (sound && !e.target.closest('.today-ambient-volume')) {
        this.audio?.toggleAmbientSound?.(sound.dataset.soundId);
      }
    });

    this.audioList?.addEventListener('input', e => {
      const slider = e.target.closest('.today-ambient-volume');
      if (!slider) return;
      this.audio?.setAmbientSoundVolume?.(slider.dataset.soundId, slider.value);
    });

    const grip = this.panel.querySelector('.today-panel-grip');
    grip?.addEventListener('pointerdown', e => this._startDrag(e));
    document.addEventListener('pointermove', e => this._moveDrag(e));
    document.addEventListener('pointerup', e => this._endDrag(e));
    document.addEventListener('pointercancel', e => this._endDrag(e));
  }

  _startDrag(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = this.panel.getBoundingClientRect();
    this._dragState = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    this.panel.classList.add('dragging');
    this.panel.style.left = rect.left + 'px';
    this.panel.style.top = rect.top + 'px';
    this.panel.style.right = 'auto';
    this.panel.style.bottom = 'auto';
    gripPointerCapture(e.currentTarget, e.pointerId);
    e.preventDefault();
  }

  _moveDrag(e) {
    if (!this._dragState || e.pointerId !== this._dragState.pointerId) return;
    const maxX = window.innerWidth - this.panel.offsetWidth - 8;
    const maxY = window.innerHeight - this.panel.offsetHeight - 8;
    const x = Math.max(8, Math.min(maxX, e.clientX - this._dragState.offsetX));
    const y = Math.max(8, Math.min(maxY, e.clientY - this._dragState.offsetY));
    this.panel.style.left = x + 'px';
    this.panel.style.top = y + 'px';
  }

  _endDrag(e) {
    if (!this._dragState || e.pointerId !== this._dragState.pointerId) return;
    this.panel.classList.remove('dragging');
    this._savePosition(parseInt(this.panel.style.left, 10), parseInt(this.panel.style.top, 10));
    this._dragState = null;
  }

  _restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(TODAY_PANEL_POSITION_KEY));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        this.panel.style.left = saved.x + 'px';
        this.panel.style.top = saved.y + 'px';
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
      }
    } catch {}
  }

  _savePosition(x, y) {
    try {
      localStorage.setItem(TODAY_PANEL_POSITION_KEY, JSON.stringify({ x, y }));
    } catch {}
  }

  _toggleSection(section, visible) {
    section?.classList.toggle('hidden', !visible);
  }

  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  _setIcon(el, icon, title = '') {
    if (!el) return;
    if (title) el.title = title;
    if (el.dataset.todayIcon === icon && !el.querySelector('i[data-lucide]')) return;
    el.dataset.todayIcon = icon;
    el.innerHTML = `<i data-lucide="${icon}"></i>`;
    this._hydrateIcons(el);
  }

  _hydrateIcons(node) {
    if (typeof lucide !== 'undefined' && node) {
      lucide.createIcons({ nodes: [node] });
    }
  }
}

function gripPointerCapture(target, pointerId) {
  try { target?.setPointerCapture?.(pointerId); } catch {}
}
