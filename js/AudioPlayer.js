import { AUDIO_CONFIG_KEY, MUSIC_CONFIG_KEY, AMBIENT_CONFIG_KEY, toast } from './utils.js';

const DEFAULT_AMBIENT_INDEX_URL = 'https://r2-music-api.larx-update.workers.dev/api/ambient';
const DEFAULT_MUSIC_INDEX_URL = 'https://r2-music-api.larx-update.workers.dev/api/songs';
const MAX_AMBIENT_SOUNDS = 96;
const AMBIENT_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'webm', 'weba']);
const AMBIENT_AUDIO_MIME_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpeg3',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-mpeg',
  'audio/x-mpeg-3',
  'audio/x-wav',
]);

export class AudioPlayer {
  constructor() {
    this.player = document.getElementById('audio-player');
    this.pill = document.getElementById('audio-pill');
    this.modeBtns = [...document.querySelectorAll('.audio-mode-btn')];
    this.musicPanel = document.getElementById('audio-panel-music');
    this.ambientPanel = document.getElementById('audio-panel-ambient');

    this.musicAudio = document.getElementById('music-audio');
    this.musicToggle = document.getElementById('music-toggle');
    this.musicPrev = document.getElementById('music-prev');
    this.musicNext = document.getElementById('music-next');
    this.musicLabel = document.getElementById('music-track-label');
    this.musicTime = document.getElementById('music-time');
    this.musicVolume = document.getElementById('music-volume');
    this.musicShuffle = document.getElementById('music-shuffle');
    this.musicRepeat = document.getElementById('music-repeat');
    this.musicProgress = document.getElementById('music-progress');
    this.musicProgressFill = document.getElementById('music-progress-fill');
    this.musicCardList = document.getElementById('music-card-list');
    this.musicTrackList = document.getElementById('music-track-list');
    this.musicNewName = document.getElementById('music-new-name');
    this.musicNewUrl = document.getElementById('music-new-url');
    this.musicAddBtn = document.getElementById('music-add-btn');
    this.musicResetBtn = document.getElementById('music-reset-defaults');
    this.musicSyncBtn = document.getElementById('music-sync-btn');

    this.ambientToggle = document.getElementById('ambient-toggle');
    this.ambientExpand = document.getElementById('ambient-expand');
    this.ambientLabel = document.getElementById('ambient-label');
    this.ambientCount = document.getElementById('ambient-count');
    this.ambientStatus = document.getElementById('ambient-status');
    this.ambientMasterVolume = document.getElementById('ambient-master-volume');
    this.ambientSoundList = document.getElementById('ambient-sound-list');
    this.ambientSettingsList = document.getElementById('ambient-settings-list');
    this.ambientIndexInput = document.getElementById('ambient-index-url');
    this.ambientSyncBtn = document.getElementById('ambient-sync-btn');
    this.ambientResetBtn = document.getElementById('ambient-reset');

    this.config = this._defaults();
    this.ambientAudios = new Map();
    this.ambientAudioCtx = null;
    this.ambientNodes = new Map();
    this._seekDragging = false;
    this._dragState = null;
    this._saveTimer = null;
    this._musicListOpen = false;
  }

  async init() {
    this.musicAudio.preload = 'auto';
    if (this.musicCardList) this.player.appendChild(this.musicCardList);
    await this._loadConfig();
    this._applyPosition();
    this._applyMusicTrack();
    this._updateMusicProgressDisplay();
    this._render();
    this._renderMusicSettingsList();
    this._renderAmbientSettings();
    this._wireEvents();
    this._wireMusicAudioEvents();
    this._checkVisibility();
  }

  toggleMusic() {
    if (this.config.music.tracks.length === 0) return;
    if (this.musicAudio.paused) {
      if (!this.musicAudio.src) this._applyMusicTrack();
      this.musicAudio.play().catch(e => console.error('Play failed:', e));
    } else {
      this.musicAudio.pause();
    }
  }

  toggle() {
    if (this.config.activeMode === 'ambient') {
      this.toggleAmbient();
      return;
    }
    this.toggleMusic();
  }

  prevTrack() {
    const music = this.config.music;
    if (music.tracks.length === 0) return;
    const wasPlaying = !this.musicAudio.paused;
    if (music.tracks.length === 1) {
      this.musicAudio.currentTime = 0;
      if (wasPlaying) this.musicAudio.play().catch(() => {});
      this._renderMusic();
      return;
    }
    if (music.shuffle) {
      this._musicShufflePrev();
    } else {
      music.currentIndex = (music.currentIndex - 1 + music.tracks.length) % music.tracks.length;
    }
    this._applyMusicTrack();
    this._saveConfig();
    this._renderMusic();
    if (wasPlaying) this.musicAudio.play().catch(() => {});
  }

  nextTrack() {
    const music = this.config.music;
    if (music.tracks.length === 0) return;
    const wasPlaying = !this.musicAudio.paused;
    if (music.tracks.length === 1) {
      this.musicAudio.currentTime = 0;
      if (wasPlaying) this.musicAudio.play().catch(() => {});
      this._renderMusic();
      return;
    }
    if (music.shuffle) {
      this._musicShuffleAdvance();
    } else {
      music.currentIndex = (music.currentIndex + 1) % music.tracks.length;
    }
    this._applyMusicTrack();
    this._saveConfig();
    this._renderMusic();
    if (wasPlaying) this.musicAudio.play().catch(() => {});
  }

  stopMusic() {
    if (!this.musicAudio.paused) this.musicAudio.pause();
  }

  setMusicVolume(value) {
    const v = this._clampVolume(value, 75);
    this.config.music.volume = v;
    this.musicAudio.volume = v / 100;
    this.musicVolume.value = v;
    this._queueSaveConfig();
  }

  seekMusicTo(percent) {
    if (!isFinite(this.musicAudio.duration)) return;
    const time = (percent / 100) * this.musicAudio.duration;
    this.musicAudio.currentTime = Math.max(0, Math.min(time, this.musicAudio.duration));
    this._updateMusicProgressDisplay();
  }

  toggleMusicShuffle() {
    const music = this.config.music;
    music.shuffle = !music.shuffle;
    if (music.shuffle) this._generateMusicShuffleOrder();
    this._saveConfig();
    this._renderMusic();
  }

  cycleMusicRepeat() {
    this.config.music.repeat = (this.config.music.repeat + 1) % 3;
    this._saveConfig();
    this._renderMusic();
  }

  addMusicTrack(name, url) {
    name = name.trim();
    url = url.trim();
    if (!name || !url) return;
    const music = this.config.music;
    music.tracks.push({ name, url });
    if (music.tracks.length === 1) {
      music.currentIndex = 0;
      this._applyMusicTrack();
    }
    if (music.shuffle) this._generateMusicShuffleOrder();
    this._saveConfig();
    this._render();
    this._renderMusicSettingsList();
    this._checkVisibility();
  }

  editMusicTrack(index, name, url) {
    name = name.trim();
    url = url.trim();
    if (!name || !url) return;
    this.config.music.tracks[index] = { name, url };
    if (this.config.music.currentIndex === index) this._applyMusicTrack();
    this._saveConfig();
    this._render();
    this._renderMusicSettingsList();
  }

  deleteMusicTrack(index) {
    const music = this.config.music;
    const wasPlaying = !this.musicAudio.paused;
    const wasActive = music.currentIndex === index;
    this.musicAudio.pause();
    music.tracks.splice(index, 1);
    if (wasActive && music.tracks.length > 0) {
      music.currentIndex = Math.min(index, music.tracks.length - 1);
      this._applyMusicTrack();
      if (wasPlaying) this.musicAudio.play().catch(() => {});
    } else if (wasActive) {
      music.currentIndex = 0;
      this._applyMusicTrack();
    } else if (music.currentIndex > index) {
      music.currentIndex--;
    }
    if (music.shuffle) this._generateMusicShuffleOrder();
    this._saveConfig();
    this._render();
    this._renderMusicSettingsList();
    this._checkVisibility();
  }

  resetMusicDefaults() {
    const wasPlaying = !this.musicAudio.paused;
    this.musicAudio.pause();
    this.config.music = this._musicDefaults();
    this._applyMusicTrack();
    if (wasPlaying) this.musicAudio.play().catch(() => {});
    this._saveConfig();
    this._render();
    this._renderMusicSettingsList();
    this._checkVisibility();
    toast('Music tracks reset to defaults', 'info');
  }

  toggleAmbient() {
    const ambient = this.config.ambient;
    if (ambient.playing) {
      this._pauseAmbientAll();
      return;
    }
    if (ambient.sounds.length > 0 && ambient.activeIds.length === 0) {
      ambient.activeIds = [ambient.sounds[0].id];
    }
    this._playAmbientActive();
  }

  toggleAmbientSound(id) {
    const ambient = this.config.ambient;
    const active = ambient.activeIds.includes(id);
    if (active) {
      ambient.activeIds = ambient.activeIds.filter(soundId => soundId !== id);
      this._pauseAmbientSound(id);
    } else {
      ambient.activeIds.push(id);
      if (!ambient.playing) ambient.playing = true;
      this._playAmbientSound(id).catch(e => {
        console.warn('Ambient playback failed:', e);
        toast('Ambient playback failed', 'error');
      });
    }

    if (ambient.activeIds.length === 0) ambient.playing = false;
    this._saveConfig();
    this._render();
    this._renderAmbientSettings();
  }

  setAmbientMasterVolume(value) {
    this.config.ambient.masterVolume = this._clampVolume(value, 70);
    this.ambientMasterVolume.value = this.config.ambient.masterVolume;
    this._updateAmbientVolumes();
    this._queueSaveConfig();
  }

  setAmbientSoundVolume(id, value) {
    this.config.ambient.volumes[id] = this._clampVolume(value, 50);
    this._updateAmbientVolumes();
    this._queueSaveConfig();
  }

  editAmbientSound(id, name, icon) {
    const sound = this.config.ambient.sounds.find(item => item.id === id);
    if (!sound) return;

    const nextName = name.trim().slice(0, 80);
    const nextIcon = icon.trim();
    if (!nextName) {
      toast('Ambient name is required', 'error');
      return;
    }
    if (!/^[a-z0-9-]{1,50}$/i.test(nextIcon)) {
      toast('Icon must be a valid Lucide icon name', 'error');
      return;
    }

    sound.name = nextName;
    sound.icon = nextIcon;
    this._saveConfig();
    this._render();
    this._renderAmbientSettings();
    toast('Ambient sound updated', 'success');
  }

  async syncMusicFromR2() {
    this.musicSyncBtn.disabled = true;
    this.musicSyncBtn.innerHTML = '<i data-lucide="loader"></i> Syncing...';
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.musicSyncBtn] });

    try {
      const data = await this._fetchViaWorker('music-sync', DEFAULT_MUSIC_INDEX_URL);
      if (!Array.isArray(data)) throw new Error('Invalid format: expected array');
      const seen = new Set();
      const tracks = [];
      data.forEach(item => {
        const name = (item.name || '').trim();
        const streamUrl = (item.streamUrl || '').trim();
        if (!name || !streamUrl) return;
        const key = `${name}|${streamUrl}`;
        if (seen.has(key)) return;
        seen.add(key);
        tracks.push({ name, url: streamUrl });
      });

      this.musicAudio.pause();
      this.config.music.tracks = tracks;
      this.config.music.currentIndex = 0;
      if (this.config.music.shuffle) this._generateMusicShuffleOrder();
      this._applyMusicTrack();
      this._saveConfig();
      this._render();
      this._renderMusicSettingsList();
      this._checkVisibility();
      toast(`Synced ${seen.size} tracks from R2`, 'success');
    } catch (e) {
      console.error('R2 sync failed:', e);
      toast(`Sync failed: ${e.message}`, 'error');
    } finally {
      this.musicSyncBtn.disabled = false;
      this.musicSyncBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Sync from R2';
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.musicSyncBtn] });
    }
  }

  async syncAmbientFromR2() {
    const ambient = this.config.ambient;
    if (this.ambientIndexInput) {
      const nextUrl = this.ambientIndexInput.value.trim();
      if (nextUrl) ambient.indexUrl = nextUrl;
    }

    this.ambientSyncBtn.disabled = true;
    this.ambientSyncBtn.innerHTML = '<i data-lucide="loader"></i> Syncing...';
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.ambientSyncBtn] });

    try {
      const data = await this._fetchViaWorker('ambient-sync', ambient.indexUrl);
      const sounds = this._normalizeAmbientSounds(data);
      if (sounds.length === 0) throw new Error('No valid sounds found');

      const validIds = new Set(sounds.map(sound => sound.id));
      const volumes = {};
      sounds.forEach(sound => {
        volumes[sound.id] = ambient.volumes[sound.id] ?? sound.defaultVolume;
      });

      for (const [id, audio] of this.ambientAudios) {
        if (!validIds.has(id)) {
          audio.pause();
          audio.removeAttribute('src');
          this.ambientAudios.delete(id);
        }
      }
      for (const id of this.ambientNodes.keys()) {
        if (!validIds.has(id)) {
          this._stopAmbientNode(id);
          this.ambientNodes.delete(id);
        }
      }

      ambient.sounds = sounds;
      ambient.volumes = volumes;
      ambient.activeIds = ambient.activeIds.filter(id => validIds.has(id));
      if (ambient.activeIds.length === 0) ambient.playing = false;

      this._saveConfig();
      this._render();
      this._renderAmbientSettings();
      this._checkVisibility();
      if (ambient.playing) this._playAmbientActive();
      toast(`Synced ${sounds.length} ambient sounds`, 'success');
    } catch (e) {
      console.error('Ambient sync failed:', e);
      toast(`Ambient sync failed: ${e.message}`, 'error');
    } finally {
      this.ambientSyncBtn.disabled = false;
      this.ambientSyncBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Sync from R2';
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.ambientSyncBtn] });
    }
  }

  resetAmbient() {
    this._pauseAmbientAll();
    for (const audio of this.ambientAudios.values()) audio.removeAttribute('src');
    this.ambientAudios.clear();
    this.ambientNodes.clear();
    this.config.ambient = {
      ...this._ambientDefaults(),
      indexUrl: this.config.ambient.indexUrl || DEFAULT_AMBIENT_INDEX_URL,
    };
    this._saveConfig();
    this._render();
    this._renderAmbientSettings();
    this._checkVisibility();
    toast('Ambient sounds cleared', 'info');
  }

  _defaults() {
    return {
      activeMode: 'music',
      position: null,
      music: this._musicDefaults(),
      ambient: this._ambientDefaults(),
    };
  }

  _musicDefaults() {
    return {
      currentIndex: 0,
      volume: 75,
      tracks: [],
      shuffle: false,
      repeat: 0,
      shuffleOrder: [],
      shufflePos: 0,
    };
  }

  _ambientDefaults() {
    return {
      indexUrl: DEFAULT_AMBIENT_INDEX_URL,
      masterVolume: 70,
      sounds: [],
      activeIds: [],
      volumes: {},
      expanded: false,
      playing: false,
    };
  }

  async _loadConfig() {
    const apply = (rawAudio, rawMusic, rawAmbient) => {
      let migrated = false;
      try {
        if (rawAudio) {
          const parsed = JSON.parse(rawAudio);
          this.config = {
            ...this._defaults(),
            ...parsed,
            music: { ...this._musicDefaults(), ...(parsed.music || {}) },
            ambient: { ...this._ambientDefaults(), ...(parsed.ambient || {}) },
          };
        } else {
          if (!rawMusic && !rawAmbient) {
            this.config = this._defaults();
          } else {
            const oldMusic = rawMusic ? JSON.parse(rawMusic) : {};
            const oldAmbient = rawAmbient ? JSON.parse(rawAmbient) : {};
            this.config = {
              ...this._defaults(),
              activeMode: oldMusic.tracks?.length ? 'music' : 'ambient',
              position: oldMusic.position || oldAmbient.position || null,
              music: { ...this._musicDefaults(), ...oldMusic },
              ambient: { ...this._ambientDefaults(), ...oldAmbient },
            };
            migrated = true;
          }
        }
      } catch {
        this.config = this._defaults();
      }

      this._normalizeLoadedConfig();
      if (migrated) this._saveConfig();
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise(resolve => {
        try {
          chrome.storage.local.get([AUDIO_CONFIG_KEY, MUSIC_CONFIG_KEY, AMBIENT_CONFIG_KEY], result => {
            apply(result[AUDIO_CONFIG_KEY], result[MUSIC_CONFIG_KEY], result[AMBIENT_CONFIG_KEY]);
            resolve();
          });
        } catch {
          apply(
            this._safeLocalStorageGet(AUDIO_CONFIG_KEY),
            this._safeLocalStorageGet(MUSIC_CONFIG_KEY),
            this._safeLocalStorageGet(AMBIENT_CONFIG_KEY)
          );
          resolve();
        }
      });
    }

    apply(
      this._safeLocalStorageGet(AUDIO_CONFIG_KEY),
      this._safeLocalStorageGet(MUSIC_CONFIG_KEY),
      this._safeLocalStorageGet(AMBIENT_CONFIG_KEY)
    );
    return Promise.resolve();
  }

  _normalizeLoadedConfig() {
    const music = this.config.music;
    const ambient = this.config.ambient;

    this.config.activeMode = this.config.activeMode === 'ambient' ? 'ambient' : 'music';

    music.tracks = Array.isArray(music.tracks) ? music.tracks : [];
    if (typeof music.currentIndex !== 'number' || music.currentIndex < 0 || music.currentIndex >= music.tracks.length) {
      music.currentIndex = 0;
    }
    music.volume = this._clampVolume(music.volume, 75);
    music.shuffle = music.shuffle === true;
    music.repeat = typeof music.repeat === 'number' && music.repeat >= 0 && music.repeat <= 2 ? music.repeat : 0;
    music.shuffleOrder = Array.isArray(music.shuffleOrder) ? music.shuffleOrder : [];
    music.shufflePos = typeof music.shufflePos === 'number' ? music.shufflePos : 0;
    this.musicAudio.volume = music.volume / 100;
    if (music.shuffle && music.tracks.length > 1 && music.shuffleOrder.length !== music.tracks.length) {
      this._generateMusicShuffleOrder();
    }

    ambient.playing = false;
    ambient.indexUrl = this._safeHttpsUrl(ambient.indexUrl) || DEFAULT_AMBIENT_INDEX_URL;
    ambient.masterVolume = this._clampVolume(ambient.masterVolume, 70);
    ambient.sounds = this._normalizeAmbientSounds(ambient.sounds);
    const validIds = new Set(ambient.sounds.map(sound => sound.id));
    ambient.activeIds = Array.isArray(ambient.activeIds)
      ? [...new Set(ambient.activeIds)].filter(id => validIds.has(id))
      : [];
    const volumes = {};
    ambient.sounds.forEach(sound => {
      volumes[sound.id] = this._clampVolume(ambient.volumes?.[sound.id], sound.defaultVolume);
    });
    ambient.volumes = volumes;
    ambient.expanded = ambient.expanded === true;
  }

  _saveConfig() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }

    const data = JSON.stringify({
      activeMode: this.config.activeMode,
      position: this.config.position,
      music: this.config.music,
      ambient: {
        indexUrl: this.config.ambient.indexUrl,
        masterVolume: this.config.ambient.masterVolume,
        sounds: this.config.ambient.sounds,
        activeIds: this.config.ambient.activeIds,
        volumes: this.config.ambient.volumes,
        expanded: this.config.ambient.expanded,
      },
    });

    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        chrome.storage.local.set({ [AUDIO_CONFIG_KEY]: data });
        return;
      } catch {}
    }
    try { localStorage.setItem(AUDIO_CONFIG_KEY, data); } catch {}
  }

  _queueSaveConfig() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._saveConfig();
    }, 300);
  }

  _applyPosition() {
    if (!this.config.position) return;
    this.player.style.left = this.config.position.x + 'px';
    this.player.style.top = this.config.position.y + 'px';
    this.player.style.right = 'auto';
    this.player.style.bottom = 'auto';
  }

  _wireEvents() {
    this.modeBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.config.activeMode = btn.dataset.audioMode === 'ambient' ? 'ambient' : 'music';
        this._musicListOpen = false;
        this._saveConfig();
        this._render();
      });
    });

    this.musicToggle.addEventListener('click', e => { e.stopPropagation(); this.toggleMusic(); });
    this.musicPrev.addEventListener('click', e => { e.stopPropagation(); this.prevTrack(); });
    this.musicNext.addEventListener('click', e => { e.stopPropagation(); this.nextTrack(); });
    this.musicShuffle.addEventListener('click', e => { e.stopPropagation(); this.toggleMusicShuffle(); });
    this.musicRepeat.addEventListener('click', e => { e.stopPropagation(); this.cycleMusicRepeat(); });
    this.musicVolume.addEventListener('input', e => this.setMusicVolume(e.target.value));
    this.musicLabel.addEventListener('click', e => {
      e.stopPropagation();
      this._toggleMusicList();
    });
    this.musicLabel.addEventListener('pointerdown', e => e.stopPropagation());
    this.musicCardList?.addEventListener('pointerdown', e => e.stopPropagation());
    this.musicAddBtn.addEventListener('click', () => {
      this.addMusicTrack(this.musicNewName.value, this.musicNewUrl.value);
      this.musicNewName.value = '';
      this.musicNewUrl.value = '';
    });
    this.musicResetBtn.addEventListener('click', () => this.resetMusicDefaults());
    this.musicSyncBtn.addEventListener('click', () => this.syncMusicFromR2());
    [this.musicNewName, this.musicNewUrl].forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.musicAddBtn.click();
      });
    });

    this.musicProgress.addEventListener('click', e => {
      e.stopPropagation();
      if (!isFinite(this.musicAudio.duration)) return;
      const rect = this.musicProgress.getBoundingClientRect();
      this.seekMusicTo(((e.clientX - rect.left) / rect.width) * 100);
    });
    this.musicProgress.addEventListener('mousedown', e => this._startMusicSeekDrag(e));

    this.ambientToggle.addEventListener('click', e => { e.stopPropagation(); this.toggleAmbient(); });
    this.ambientExpand.addEventListener('click', e => {
      e.stopPropagation();
      this.config.ambient.expanded = !this.config.ambient.expanded;
      this._saveConfig();
      this._render();
    });
    this.ambientMasterVolume.addEventListener('input', e => this.setAmbientMasterVolume(e.target.value));
    this.ambientSyncBtn.addEventListener('click', () => this.syncAmbientFromR2());
    this.ambientResetBtn.addEventListener('click', () => this.resetAmbient());
    this.ambientIndexInput.addEventListener('change', () => {
      const nextUrl = this._safeHttpsUrl(this.ambientIndexInput.value.trim());
      if (!nextUrl) {
        this.ambientIndexInput.value = this.config.ambient.indexUrl;
        toast('Ambient index must be an HTTPS URL', 'error');
        return;
      }
      this.config.ambient.indexUrl = nextUrl;
      this._saveConfig();
    });

    this.pill.addEventListener('pointerdown', e => this._startDrag(e));
    document.addEventListener('click', e => {
      if (!this._musicListOpen || this.player.contains(e.target)) return;
      this._musicListOpen = false;
      this._render();
    });
    document.addEventListener('pointermove', e => this._moveDrag(e));
    document.addEventListener('pointerup', e => this._endDrag(e));
    document.addEventListener('pointercancel', e => this._endDrag(e));
    window.addEventListener('pagehide', () => this._saveConfig());
  }

  _wireMusicAudioEvents() {
    this.musicAudio.addEventListener('play', () => this._render());
    this.musicAudio.addEventListener('pause', () => this._render());
    this.musicAudio.addEventListener('timeupdate', () => {
      if (!this._seekDragging) this._updateMusicProgressDisplay();
    });
    this.musicAudio.addEventListener('loadedmetadata', () => this._updateMusicProgressDisplay());
    this.musicAudio.addEventListener('ended', () => this._handleMusicEnded());
    this.musicAudio.addEventListener('error', () => {
      const track = this.config.music.tracks[this.config.music.currentIndex];
      toast(`${track ? track.name : 'Track'} unavailable`, 'error');
    });
  }

  _startDrag(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('#music-progress') || e.target.closest('#music-track-label') || e.target.closest('#music-card-list') || e.target.closest('#ambient-sound-list')) return;
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
  }

  _moveDrag(e) {
    if (!this._dragState || e.pointerId !== this._dragState.pointerId) return;
    const dx = Math.abs(e.clientX - this._dragState.startX);
    const dy = Math.abs(e.clientY - this._dragState.startY);
    if (dx > 3 || dy > 3) this._dragState.moved = true;
    if (!this._dragState.moved) return;
    this.player.style.left = (e.clientX - this._dragState.offsetX) + 'px';
    this.player.style.top = (e.clientY - this._dragState.offsetY) + 'px';
    this.player.style.right = 'auto';
    this.player.style.bottom = 'auto';
  }

  _endDrag(e) {
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
  }

  _startMusicSeekDrag(e) {
    e.stopPropagation();
    e.preventDefault();
    if (!isFinite(this.musicAudio.duration)) return;
    this._seekDragging = true;

    const onMove = ev => {
      if (!this._seekDragging) return;
      const rect = this.musicProgress.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      this.seekMusicTo(pct);
    };
    const onUp = () => {
      this._seekDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    onMove(e);
  }

  _render() {
    this.player.classList.toggle('mode-music', this.config.activeMode === 'music');
    this.player.classList.toggle('mode-ambient', this.config.activeMode === 'ambient');
    this.player.classList.toggle('music-playing', !this.musicAudio.paused);
    this.player.classList.toggle('ambient-playing', this.config.ambient.playing);
    this.player.classList.toggle('playing', !this.musicAudio.paused || this.config.ambient.playing);
    this.player.classList.toggle('ambient-expanded', this.config.ambient.expanded);
    this.player.classList.toggle('music-list-open', this._musicListOpen && this.config.activeMode === 'music');

    this.modeBtns.forEach(btn => {
      const active = btn.dataset.audioMode === this.config.activeMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    this.musicPanel.classList.toggle('hidden', this.config.activeMode !== 'music');
    this.ambientPanel.classList.toggle('hidden', this.config.activeMode !== 'ambient');

    this._renderMusic();
    this._renderAmbient();
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.player] });
  }

  _renderMusic() {
    const music = this.config.music;
    const track = music.tracks[music.currentIndex];
    this.musicLabel.textContent = track ? track.name : 'Music';
    this.musicVolume.value = music.volume;
    this.musicToggle.innerHTML = this.musicAudio.paused ? '<i data-lucide="play"></i>' : '<i data-lucide="pause"></i>';
    this.musicShuffle.classList.toggle('active', music.shuffle);
    this.musicShuffle.title = music.shuffle ? 'Shuffle on' : 'Shuffle off';
    this.musicRepeat.classList.remove('active', 'repeat-one');
    if (music.repeat === 1) {
      this.musicRepeat.classList.add('active');
      this.musicRepeat.innerHTML = '<i data-lucide="repeat"></i>';
      this.musicRepeat.title = 'Repeat all';
    } else if (music.repeat === 2) {
      this.musicRepeat.classList.add('active', 'repeat-one');
      this.musicRepeat.innerHTML = '<i data-lucide="repeat-1"></i>';
      this.musicRepeat.title = 'Repeat one';
    } else {
      this.musicRepeat.innerHTML = '<i data-lucide="repeat"></i>';
      this.musicRepeat.title = 'Repeat off';
    }
    this._renderMusicCardList();
  }

  _renderMusicCardList() {
    if (!this.musicCardList) return;
    this.musicCardList.innerHTML = '';

    this.config.music.tracks.forEach((track, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'music-card-track';
      item.classList.toggle('active', i === this.config.music.currentIndex);
      item.title = track.name;

      const index = document.createElement('span');
      index.className = 'music-card-track-index';
      index.textContent = String(i + 1).padStart(2, '0');

      const name = document.createElement('span');
      name.className = 'music-card-track-name';
      name.textContent = track.name;

      item.appendChild(index);
      item.appendChild(name);
      item.addEventListener('click', () => {
        if (this.config.music.currentIndex === i) return;
        const wasPlaying = !this.musicAudio.paused;
        this.musicAudio.pause();
        this.config.music.currentIndex = i;
        this._musicListOpen = false;
        if (this.config.music.shuffle) {
          const orderIdx = this.config.music.shuffleOrder.indexOf(i);
          if (orderIdx !== -1) this.config.music.shufflePos = orderIdx;
        }
        this._applyMusicTrack();
        this._saveConfig();
        this._render();
        this._renderMusicSettingsList();
        if (wasPlaying) this.musicAudio.play().catch(() => {});
      });

      this.musicCardList.appendChild(item);
    });
  }

  _toggleMusicList() {
    if (this.config.activeMode !== 'music' || this.config.music.tracks.length === 0) return;
    this._musicListOpen = !this._musicListOpen;
    this._render();
  }

  _renderMusicSettingsList() {
    this.musicTrackList.innerHTML = '';
    this.config.music.tracks.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = 'music-track-row';
      const isActive = i === this.config.music.currentIndex;

      const nameEl = document.createElement('span');
      nameEl.className = 'track-name' + (isActive ? ' active' : '');
      nameEl.textContent = track.name;
      const urlEl = document.createElement('span');
      urlEl.className = 'track-url';
      urlEl.textContent = track.url;
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
      this.musicTrackList.appendChild(row);

      delBtn.addEventListener('click', () => this.deleteMusicTrack(i));
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
          this.editMusicTrack(i, nameEl.textContent, urlEl.textContent);
        }
      });
      info.addEventListener('click', () => {
        if (row.classList.contains('editing') || this.config.music.currentIndex === i) return;
        const wasPlaying = !this.musicAudio.paused;
        this.musicAudio.pause();
        this.config.music.currentIndex = i;
        if (this.config.music.shuffle) {
          const orderIdx = this.config.music.shuffleOrder.indexOf(i);
          if (orderIdx !== -1) this.config.music.shufflePos = orderIdx;
        }
        this._applyMusicTrack();
        if (wasPlaying) this.musicAudio.play().catch(() => {});
        this._saveConfig();
        this._render();
        this._renderMusicSettingsList();
      });
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [row] });
    });
  }

  _renderAmbient() {
    const ambient = this.config.ambient;
    const activeCount = ambient.activeIds.length;
    this.ambientLabel.textContent = 'Ambient';
    this.ambientCount.textContent = String(activeCount);
    this.ambientStatus.textContent = ambient.sounds.length === 0
      ? 'Sync sounds'
      : activeCount === 0
        ? 'Choose sounds'
        : `${activeCount} active`;
    this.ambientMasterVolume.value = ambient.masterVolume;
    this.ambientToggle.innerHTML = ambient.playing ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
    this.ambientToggle.title = ambient.playing ? 'Pause ambient sounds' : 'Play ambient sounds';
    this.ambientExpand.innerHTML = ambient.expanded ? '<i data-lucide="chevron-down"></i>' : '<i data-lucide="sliders-horizontal"></i>';
    this.ambientExpand.title = ambient.expanded ? 'Hide mixer' : 'Show mixer';
    this._renderAmbientSoundList(this.ambientSoundList, true);
  }

  _renderAmbientSettings() {
    this.ambientIndexInput.value = this.config.ambient.indexUrl;
    this._renderAmbientSoundList(this.ambientSettingsList, false);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [this.ambientSettingsList, this.ambientSyncBtn] });
  }

  _renderAmbientSoundList(container, compact) {
    container.innerHTML = '';
    const ambient = this.config.ambient;
    if (ambient.sounds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ambient-empty';
      empty.textContent = compact ? 'No sounds synced yet.' : 'Sync from R2 to load ambient loops.';
      container.appendChild(empty);
      return;
    }

    ambient.sounds.forEach(sound => {
      const row = document.createElement('div');
      row.className = 'ambient-sound-row';
      row.classList.toggle('active', ambient.activeIds.includes(sound.id));

      if (!compact) {
        row.classList.add('ambient-settings-row');

        const iconPreview = document.createElement('span');
        iconPreview.className = 'ambient-settings-icon';
        iconPreview.innerHTML = `<i data-lucide="${sound.icon}"></i>`;

        const fields = document.createElement('div');
        fields.className = 'ambient-settings-fields';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'ambient-setting-input';
        nameInput.value = sound.name;
        nameInput.placeholder = 'Sound name';

        const iconInput = document.createElement('input');
        iconInput.type = 'text';
        iconInput.className = 'ambient-setting-input';
        iconInput.value = sound.icon;
        iconInput.placeholder = 'Lucide icon name';

        fields.appendChild(nameInput);
        fields.appendChild(iconInput);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'ambient-save-btn';
        saveBtn.innerHTML = '<i data-lucide="check"></i>';
        saveBtn.title = 'Save ambient sound';

        row.appendChild(iconPreview);
        row.appendChild(fields);
        row.appendChild(saveBtn);
        container.appendChild(row);

        const save = () => this.editAmbientSound(sound.id, nameInput.value, iconInput.value);
        saveBtn.addEventListener('click', save);
        [nameInput, iconInput].forEach(input => {
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') save();
          });
        });
        return;
      }

      const toggle = document.createElement('button');
      toggle.className = 'ambient-sound-toggle';
      toggle.title = ambient.activeIds.includes(sound.id) ? `Stop ${sound.name}` : `Play ${sound.name}`;
      toggle.innerHTML = `<i data-lucide="${sound.icon}"></i>`;
      const name = document.createElement('span');
      name.className = 'ambient-sound-name';
      name.textContent = sound.name;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = ambient.volumes[sound.id] ?? sound.defaultVolume;
      slider.className = 'ambient-volume';
      slider.title = `${sound.name} volume`;
      row.appendChild(toggle);
      row.appendChild(name);
      row.appendChild(slider);
      container.appendChild(row);
      row.addEventListener('click', e => {
        if (e.target.closest('.ambient-volume')) return;
        this.toggleAmbientSound(sound.id);
      });
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleAmbientSound(sound.id);
      });
      slider.addEventListener('click', e => e.stopPropagation());
      slider.addEventListener('input', e => this.setAmbientSoundVolume(sound.id, e.target.value));
    });
  }

  _applyMusicTrack() {
    const track = this.config.music.tracks[this.config.music.currentIndex];
    if (track) {
      this.musicAudio.src = track.url;
    } else {
      this.musicAudio.removeAttribute('src');
    }
  }

  _generateMusicShuffleOrder() {
    const music = this.config.music;
    const order = Array.from({ length: music.tracks.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.length > 1 && order[0] === music.currentIndex) [order[0], order[1]] = [order[1], order[0]];
    music.shuffleOrder = order;
    music.shufflePos = 0;
  }

  _musicShuffleAdvance() {
    const music = this.config.music;
    let pos = music.shufflePos + 1;
    if (pos >= music.shuffleOrder.length) {
      if (music.repeat === 1) {
        this._generateMusicShuffleOrder();
        pos = 0;
      } else {
        return;
      }
    }
    music.shufflePos = pos;
    music.currentIndex = music.shuffleOrder[pos];
  }

  _musicShufflePrev() {
    const music = this.config.music;
    let pos = music.shufflePos - 1;
    if (pos < 0) pos = music.shuffleOrder.length - 1;
    music.shufflePos = pos;
    music.currentIndex = music.shuffleOrder[pos];
  }

  _handleMusicEnded() {
    const music = this.config.music;
    if (music.repeat === 2) {
      this.musicAudio.currentTime = 0;
      this.musicAudio.play().catch(() => {});
      return;
    }
    if (music.shuffle && music.tracks.length > 1) {
      const nextPos = music.shufflePos + 1;
      if (nextPos >= music.shuffleOrder.length && music.repeat !== 1) {
        this._render();
        return;
      }
      this._musicShuffleAdvance();
      this._applyMusicTrack();
      this._saveConfig();
      this._render();
      this.musicAudio.play().catch(() => {});
      return;
    }
    if (music.currentIndex < music.tracks.length - 1) {
      music.currentIndex++;
      this._applyMusicTrack();
      this._saveConfig();
      this._render();
      this.musicAudio.play().catch(() => {});
    } else if (music.repeat === 1) {
      music.currentIndex = 0;
      this._applyMusicTrack();
      this._saveConfig();
      this._render();
      this.musicAudio.play().catch(() => {});
    } else {
      this._render();
    }
  }

  _formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  _updateMusicProgressDisplay() {
    const duration = this.musicAudio.duration;
    const current = this.musicAudio.currentTime;
    const pct = duration && isFinite(duration) ? (current / duration) * 100 : 0;
    this.musicProgressFill.style.width = `${pct}%`;
    this.musicTime.textContent = `${this._formatTime(current)} / ${this._formatTime(duration)}`;
  }

  _playAmbientActive() {
    const ambient = this.config.ambient;
    if (ambient.activeIds.length === 0) return;
    ambient.playing = true;
    this._updateAmbientVolumes();
    const plays = ambient.activeIds.map(id => this._playAmbientSound(id));
    Promise.allSettled(plays).then(results => {
      if (results.every(result => result.status === 'rejected')) {
        ambient.playing = false;
        this._render();
        toast('Ambient playback failed', 'error');
      }
    });
    this._saveConfig();
    this._render();
  }

  _playAmbientSound(id) {
    const sound = this.config.ambient.sounds.find(item => item.id === id);
    if (!sound) return Promise.reject(new Error('Unknown sound'));
    return this._playAmbientWebAudio(sound).catch(() => this._playAmbientHtmlAudio(sound));
  }

  async _playAmbientWebAudio(sound) {
    const ctx = this._ensureAmbientAudioContext();
    await ctx.resume();

    let node = this.ambientNodes.get(sound.id);
    if (node?.source) return;
    if (!node) {
      node = { buffer: null, loading: null, source: null, gain: null };
      this.ambientNodes.set(sound.id, node);
    }

    if (!node.buffer) {
      node.loading = node.loading || this._loadAmbientBuffer(ctx, sound.url);
      try {
        node.buffer = await node.loading;
      } catch (e) {
        node.loading = null;
        throw e;
      }
      node.loading = null;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = node.buffer;
    source.loop = true;
    gain.gain.value = this._ambientVolumeFor(sound.id);
    source.connect(gain);
    gain.connect(ctx.destination);
    node.source = source;
    node.gain = gain;
    source.onended = () => {
      if (node.source === source) node.source = null;
    };
    source.start(0);
  }

  async _playAmbientHtmlAudio(sound) {
    const audio = this._getAmbientAudio(sound);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this._ambientVolumeFor(sound.id);
    return audio.play();
  }

  _pauseAmbientSound(id) {
    this._stopAmbientNode(id);
    const audio = this.ambientAudios.get(id);
    if (audio) audio.pause();
  }

  _pauseAmbientAll() {
    this.config.ambient.playing = false;
    for (const id of this.ambientNodes.keys()) this._stopAmbientNode(id);
    for (const audio of this.ambientAudios.values()) audio.pause();
    this._saveConfig();
    this._render();
  }

  _getAmbientAudio(sound) {
    let audio = this.ambientAudios.get(sound.id);
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.addEventListener('error', () => toast(`${sound.name} unavailable`, 'error'));
      this.ambientAudios.set(sound.id, audio);
    }
    if (audio.src !== sound.url) audio.src = sound.url;
    return audio;
  }

  _updateAmbientVolumes() {
    this.config.ambient.sounds.forEach(sound => {
      const audio = this.ambientAudios.get(sound.id);
      if (audio) audio.volume = this._ambientVolumeFor(sound.id);
      const node = this.ambientNodes.get(sound.id);
      if (node?.gain && this.ambientAudioCtx) {
        node.gain.gain.setTargetAtTime(this._ambientVolumeFor(sound.id), this.ambientAudioCtx.currentTime, 0.015);
      }
    });
  }

  _ensureAmbientAudioContext() {
    if (!this.ambientAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio unavailable');
      this.ambientAudioCtx = new AudioCtx();
    }
    return this.ambientAudioCtx;
  }

  async _loadAmbientBuffer(ctx, url) {
    const res = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    return ctx.decodeAudioData(data.slice(0));
  }

  _stopAmbientNode(id) {
    const node = this.ambientNodes.get(id);
    if (!node) return;
    if (node.source) {
      try { node.source.stop(0); } catch {}
      try { node.source.disconnect(); } catch {}
      node.source = null;
    }
    if (node.gain) {
      try { node.gain.disconnect(); } catch {}
      node.gain = null;
    }
  }

  _ambientVolumeFor(id) {
    const ambient = this.config.ambient;
    return Math.max(0, Math.min(1, (this._clampVolume(ambient.volumes[id], 50) / 100) * (ambient.masterVolume / 100)));
  }

  _normalizeAmbientSounds(data) {
    const source = Array.isArray(data) ? data : Array.isArray(data?.sounds) ? data.sounds : [];
    const seen = new Set();
    const sounds = source.map((item, index) => {
      const fileKey = this._firstString(item.key, item.name, item.filename, item.fileName, item.path);
      const rawId = (item.id || fileKey || `sound-${index + 1}`).toString().trim().toLowerCase();
      const id = rawId.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || `sound-${index + 1}`;
      const name = (item.title || item.label || item.displayName || this._labelFromFileName(item.name || fileKey || id)).toString().trim().slice(0, 80);
      const url = this._ambientSoundUrl(item);
      const type = this._ambientAudioType(item);
      const extension = this._audioExtensionFrom(fileKey) || this._audioExtensionFrom(url);
      const icon = /^[a-z0-9-]{1,50}$/i.test(item.icon || '') ? item.icon : this._inferAmbientIcon(id);
      if (!name || !url || seen.has(id) || !this._isSupportedAmbientAudio(type, extension)) return null;
      seen.add(id);
      return { id, name, icon, url, defaultVolume: this._clampVolume(item.defaultVolume ?? item.volume, 50) };
    }).filter(Boolean);
    return sounds.slice(0, MAX_AMBIENT_SOUNDS);
  }

  _ambientSoundUrl(item) {
    return this._safeHttpsUrl(this._firstString(
      item.url,
      item.streamUrl,
      item.stream_url,
      item.src,
      item.href,
      item.downloadUrl,
      item.download_url,
      item.publicUrl,
      item.public_url,
      item.mediaUrl,
      item.media_url,
      item.fileUrl,
      item.file_url
    ));
  }

  _firstString(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  _normalizeAudioType(value) {
    if (!value) return '';
    return value.split(';')[0].trim().toLowerCase();
  }

  _ambientAudioType(item) {
    const explicitType = this._firstString(item.contentType, item.content_type, item.mimeType, item.mime);
    if (explicitType) return this._normalizeAudioType(explicitType);
    return typeof item.type === 'string' && item.type.includes('/') ? this._normalizeAudioType(item.type) : '';
  }

  _audioExtensionFrom(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      value = url.pathname;
    } catch {}
    const match = value.toString().toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  _isSupportedAmbientAudio(type, extension) {
    if (type && AMBIENT_AUDIO_MIME_TYPES.has(type)) return true;
    if (extension && AMBIENT_AUDIO_EXTENSIONS.has(extension)) return true;
    return !type && !extension;
  }

  _labelFromFileName(value) {
    return value.toString().trim().split('/').pop().replace(/\.[a-z0-9]+$/i, '')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Ambient Sound';
  }

  _inferAmbientIcon(id) {
    if (/rain|drizzle|storm/.test(id)) return 'cloud-rain';
    if (/thunder/.test(id)) return 'cloud-lightning';
    if (/wind/.test(id)) return 'wind';
    if (/wave|ocean|sea|river|stream/.test(id)) return 'waves';
    if (/fire|flame|campfire/.test(id)) return 'flame';
    if (/bird|forest/.test(id)) return 'bird';
    if (/coffee|cafe/.test(id)) return 'coffee';
    return 'audio-lines';
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

  _fetchViaWorker(type, url) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        this._fetchDirect(url).then(resolve).catch(reject);
        return;
      }
      chrome.runtime.sendMessage({ type, url }, response => {
        if (chrome.runtime.lastError) {
          const message = chrome.runtime.lastError.message;
          this._fetchDirect(url).then(resolve).catch(() => reject(new Error(message)));
        } else if (!response?.ok) {
          reject(new Error(response?.error || 'No response from background worker'));
        } else {
          resolve(response.data);
        }
      });
    });
  }

  async _fetchDirect(url) {
    const safeUrl = this._safeHttpsUrl(url);
    if (!safeUrl) throw new Error('Index must be an HTTPS URL');
    const res = await fetch(safeUrl, { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  _safeLocalStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  _checkVisibility() {
    this.player.classList.toggle('hidden', this.config.music.tracks.length === 0 && this.config.ambient.sounds.length === 0);
  }
}
