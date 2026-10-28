import { toast } from './utils.js';

// Sessions are intentionally tab-local: reload never starts audio automatically.
export class FocusMode {
  constructor({ pomodoro, audio }) {
    this.pomodoro = pomodoro;
    this.audio = audio;
    this.active = false;
    this.soundId = null;
    this.starting = false;
  }

  init() {
    this.button = document.getElementById('focus-start');
    this.task = document.getElementById('focus-task');
    this.ambient = document.getElementById('focus-ambient');
    this.select = document.getElementById('focus-sound');
    this.status = document.getElementById('focus-status');
    if (!this.button) return;
    this.button.addEventListener('click', () => this.active ? this.end(true) : this.start());
    this.ambient.addEventListener('change', () => this.renderSounds());
    window.addEventListener('canopy:audio-update', () => this.renderSounds());
    window.addEventListener('canopy:pomodoro-update', () => {
      if (this.active && this.pomodoro.getSnapshot().phase !== 'work') this.end(false);
    });
    this.renderSounds();
  }

  renderSounds() {
    const sounds = this.audio.getSnapshot().ambientSounds || [];
    const key = JSON.stringify(sounds.map(({ id, name }) => [id, name]));
    if (key !== this._soundsKey) {
      this._soundsKey = key;
      const selected = this.select.value;
      this.select.replaceChildren(...sounds.map(sound => {
        const option = document.createElement('option');
        option.value = sound.id;
        option.textContent = sound.name;
        return option;
      }));
      if (sounds.some(sound => sound.id === selected)) this.select.value = selected;
    }
    this.select.hidden = !this.ambient.checked;
    this.select.disabled = this.active || this.starting || sounds.length === 0;
    this.ambient.disabled = this.active || this.starting;
    if (!sounds.length && this.ambient.checked && !this.active) {
      this.status.textContent = 'Sync ambient sounds in Audio first.';
    }
  }

  async start() {
    if (this.starting) return;
    const snap = this.audio.getSnapshot();
    if (this.ambient.checked && !this.select.value) {
      this.status.textContent = 'Choose an ambient sound first.';
      return;
    }
    // Never replace audio already chosen by the user.
    if (this.ambient.checked && snap.playing) {
      this.status.textContent = 'Pause current audio first, or uncheck ambient.';
      return;
    }
    this.starting = true;
    this.button.disabled = true;
    this.renderSounds();
    try {
      if (this.ambient.checked) {
        this.soundId = this.select.value;
        const played = await this.audio.startFocusAmbient(this.soundId);
        if (!played) {
          this.soundId = null;
          this.status.textContent = 'Audio unavailable. Uncheck ambient to focus silently.';
          return;
        }
      }
      this.pomodoro.startFocus();
      this.active = true;
      this.task.disabled = true;
      this.button.textContent = 'End focus';
      this.status.textContent = this.task.value.trim() || 'One thing at a time.';
      document.getElementById('today-panel')?.classList.add('focus-active');
      document.getElementById('today-panel')?.classList.remove('audio-expanded');
      const expand = document.getElementById('today-audio-expand');
      expand?.setAttribute('aria-expanded', 'false');
      expand?.setAttribute('aria-label', 'Show audio controls');
    } catch (error) {
      this.stopOwnedAudio();
      this.status.textContent = 'Could not start focus. Try again.';
      toast('Could not start focus', 'error');
    } finally {
      this.starting = false;
      this.button.disabled = false;
      this.renderSounds();
    }
  }

  stopOwnedAudio() {
    const snap = this.audio.getSnapshot();
    const selected = snap.ambientSounds.filter(sound => sound.active);
    // Leave manually changed mixes alone.
    if (this.soundId && selected.length === 1 && selected[0].id === this.soundId) {
      this.audio.stopAmbient();
    }
    this.soundId = null;
  }

  end(pause) {
    this.active = false;
    if (pause) this.pomodoro.pause();
    this.stopOwnedAudio();
    this.task.disabled = false;
    this.button.textContent = 'Start focus';
    this.status.textContent = pause ? 'Session paused.' : 'Time for a break.';
    document.getElementById('today-panel')?.classList.remove('focus-active');
    this.renderSounds();
  }
}
