import { toast } from './utils.js';

const POMODORO_CONFIG_KEY = 'pomodoro_config';

export class PomodoroTimer {
  constructor() {
    this.player        = document.getElementById('pomodoro-player');
    this.pill          = document.getElementById('pomodoro-pill');
    this.toggleBtn     = document.getElementById('pomodoro-toggle');
    this.resetBtn      = document.getElementById('pomodoro-reset');
    this.skipBtn       = document.getElementById('pomodoro-skip');
    this.modeLabel     = document.getElementById('pomodoro-mode');
    this.timeDisplay   = document.getElementById('pomodoro-time');
    this.sessionCount  = document.getElementById('pomodoro-sessions');
    this.collapseBtn   = document.getElementById('pomodoro-collapse');
    this.progressRing  = document.getElementById('pomodoro-progress-ring');
    this.progressCircle = document.getElementById('pomodoro-progress-circle');

    this.config = this._defaults();
    this._interval = null;
    this._dragState = null;
    this._remaining = 0;   // seconds remaining
    this._total = 0;       // total seconds for current phase
    this._running = false;
  }

  init() {
    this._loadConfig();
    this._applyPosition();
    this._setPhaseTime();
    this._render();
    this._wireEvents();
    this._wireSettings();
  }

  // ═══════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════

  toggle() {
    if (this._running) {
      this._pause();
    } else {
      this._start();
    }
  }

  reset() {
    this._pause();
    this._setPhaseTime();
    this._render();
  }

  skip() {
    this._pause();
    this._advancePhase();
    this._render();
  }

  toggleCollapsed() {
    this.config.collapsed = !this.config.collapsed;
    this._saveConfig();
    this._render();
  }

  // ═══════════════════════════════════════════════
  //  TIMER LOGIC
  // ═══════════════════════════════════════════════

  _start() {
    if (this._remaining <= 0) this._setPhaseTime();
    this._running = true;
    this._render();

    this._interval = setInterval(() => {
      this._remaining--;
      this._render();

      if (this._remaining <= 0) {
        this._pause();
        this._onPhaseComplete();
      }
    }, 1000);
  }

  _pause() {
    this._running = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._render();
  }

  _onPhaseComplete() {
    // Play a subtle notification sound
    this._playNotification();

    if (this.config.phase === 'work') {
      this.config.completedSessions++;
      this._saveConfig();
      toast(`Session #${this.config.completedSessions} complete! Time for a break.`, 'success');
    } else {
      toast('Break over! Ready to focus?', 'info');
    }

    this._advancePhase();
    this._render();
  }

  _advancePhase() {
    if (this.config.phase === 'work') {
      // Every 4 sessions → long break
      if (this.config.completedSessions > 0 && this.config.completedSessions % 4 === 0) {
        this.config.phase = 'longBreak';
      } else {
        this.config.phase = 'shortBreak';
      }
    } else {
      this.config.phase = 'work';
    }
    this._setPhaseTime();
    this._saveConfig();
  }

  _setPhaseTime() {
    const durations = {
      work: this.config.workMinutes * 60,
      shortBreak: this.config.shortBreakMinutes * 60,
      longBreak: this.config.longBreakMinutes * 60
    };
    this._total = durations[this.config.phase] || durations.work;
    this._remaining = this._total;
  }

  _playNotification() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
    } catch {}
  }

  // ═══════════════════════════════════════════════
  //  PERSISTENCE
  // ═══════════════════════════════════════════════

  _defaults() {
    return {
      phase: 'work',
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      completedSessions: 0,
      position: null,
      collapsed: false
    };
  }

  _loadConfig() {
    try {
      const raw = localStorage.getItem(POMODORO_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.config = { ...this._defaults(), ...parsed };
      }
    } catch {}

    if (!['work', 'shortBreak', 'longBreak'].includes(this.config.phase)) {
      this.config.phase = 'work';
    }
    if (typeof this.config.completedSessions !== 'number') this.config.completedSessions = 0;
    if (typeof this.config.collapsed !== 'boolean') this.config.collapsed = false;
  }

  _saveConfig() {
    try {
      localStorage.setItem(POMODORO_CONFIG_KEY, JSON.stringify({
        phase: this.config.phase,
        workMinutes: this.config.workMinutes,
        shortBreakMinutes: this.config.shortBreakMinutes,
        longBreakMinutes: this.config.longBreakMinutes,
        completedSessions: this.config.completedSessions,
        position: this.config.position,
        collapsed: this.config.collapsed
      }));
    } catch {}
  }

  _applyPosition() {
    if (this.config.position) {
      this.player.style.left = this.config.position.x + 'px';
      this.player.style.top = this.config.position.y + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    }
  }

  // ═══════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  _render() {
    // Time display
    this.timeDisplay.textContent = this._formatTime(this._remaining);

    // Mode label
    const labels = {
      work: 'Focus',
      shortBreak: 'Break',
      longBreak: 'Long Break'
    };
    this.modeLabel.textContent = labels[this.config.phase] || 'Focus';

    // Session count
    this.sessionCount.textContent = `#${this.config.completedSessions}`;

    // Play/Pause icon
    this.toggleBtn.innerHTML = this._running
      ? '<i data-lucide="pause"></i>'
      : '<i data-lucide="play"></i>';
    this.toggleBtn.title = this._running ? 'Pause' : 'Start';

    // Phase classes
    this.player.classList.remove('phase-work', 'phase-break', 'phase-long');
    if (this.config.phase === 'work') {
      this.player.classList.add('phase-work');
    } else if (this.config.phase === 'shortBreak') {
      this.player.classList.add('phase-break');
    } else {
      this.player.classList.add('phase-long');
    }

    // Running state
    this.player.classList.toggle('running', this._running);

    // Collapsed state
    this.player.classList.toggle('collapsed', this.config.collapsed);
    this.collapseBtn.innerHTML = this.config.collapsed
      ? '<i data-lucide="chevron-up"></i>'
      : '<i data-lucide="chevron-down"></i>';
    this.collapseBtn.title = this.config.collapsed ? 'Expand' : 'Collapse';

    // Progress ring
    this._updateProgressRing();

    // Re-create lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [this.toggleBtn, this.collapseBtn, this.resetBtn, this.skipBtn] });
    }
  }

  _updateProgressRing() {
    if (!this.progressCircle) return;
    const circumference = 2 * Math.PI * 18; // r=18
    const progress = this._total > 0 ? (this._total - this._remaining) / this._total : 0;
    const offset = circumference - (progress * circumference);
    this.progressCircle.style.strokeDasharray = `${circumference}`;
    this.progressCircle.style.strokeDashoffset = `${offset}`;
  }

  // ═══════════════════════════════════════════════
  //  EVENT WIRING
  // ═══════════════════════════════════════════════

  _wireEvents() {
    this.toggleBtn.addEventListener('click', e => { e.stopPropagation(); this.toggle(); });
    this.resetBtn.addEventListener('click', e => { e.stopPropagation(); this.reset(); });
    this.skipBtn.addEventListener('click', e => { e.stopPropagation(); this.skip(); });
    this.collapseBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleCollapsed(); });

    // Drag to reposition
    this.pill.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
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
      }
      this._dragState = null;
    });
  }

  _wireSettings() {
    const workInput = document.getElementById('pomodoro-work-min');
    const shortInput = document.getElementById('pomodoro-short-min');
    const longInput = document.getElementById('pomodoro-long-min');
    const resetSessionsBtn = document.getElementById('pomodoro-reset-sessions');

    // Populate settings with current config
    if (workInput) workInput.value = this.config.workMinutes;
    if (shortInput) shortInput.value = this.config.shortBreakMinutes;
    if (longInput) longInput.value = this.config.longBreakMinutes;

    const updateDuration = (key, input) => {
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < 1) return;
      this.config[key] = val;
      this._saveConfig();
      // If not running, update remaining time
      if (!this._running) {
        this._setPhaseTime();
        this._render();
      }
    };

    if (workInput) workInput.addEventListener('change', () => updateDuration('workMinutes', workInput));
    if (shortInput) shortInput.addEventListener('change', () => updateDuration('shortBreakMinutes', shortInput));
    if (longInput) longInput.addEventListener('change', () => updateDuration('longBreakMinutes', longInput));

    if (resetSessionsBtn) {
      resetSessionsBtn.addEventListener('click', () => {
        this.config.completedSessions = 0;
        this._saveConfig();
        this._render();
        toast('Session count reset', 'info');
      });
    }
  }
}
