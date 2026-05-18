/* ============================================================
   CANOPY — js/ClockWidget.js
   Clock display widget
   ============================================================ */

import { DAYS, MONTHS, pad2 } from './utils.js';

const STORAGE_KEY = 'canopy_clock_position';
const SIZE_KEY = 'canopy_clock_size';

export class ClockWidget {
  constructor() {
    this.container = document.getElementById('center-widget');
    this.clockEl = document.getElementById('taskbar-clock');
    this.timeEl = document.getElementById('clock-time');
    this.dateEl = document.getElementById('clock-date');
    this._intervalId = null;
    this._timeoutId = null;
    this._dragState = null;
    this._resizeState = null;
    this._baseTimeSize = 80;
    this._baseDateSize = 14;
    this._scale = 1;
    this._lastMood = null;
    this._restorePosition();
    this._restoreSize();
    this._initDrag();
    this._initResize();
  }

  _restoreSize() {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY));
      if (saved && typeof saved.scale === 'number' && saved.scale > 0) {
        this._scale = saved.scale;
        this._applySize();
      }
    } catch {}
  }

  _saveSize() {
    localStorage.setItem(SIZE_KEY, JSON.stringify({ scale: this._scale }));
  }

  _applySize() {
    this.timeEl.style.fontSize = `${this._baseTimeSize * this._scale}px`;
    this.dateEl.style.fontSize = `${this._baseDateSize * this._scale}px`;
  }

  _initResize() {
    const handle = document.createElement('div');
    handle.id = 'clock-resize-handle';
    handle.title = 'Drag to resize';
    this.clockEl.appendChild(handle);

    this._onResizeMove = this._onResizeMove.bind(this);
    this._onResizeEnd = this._onResizeEnd.bind(this);

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const rect = this.clockEl.getBoundingClientRect();
      this._resizeState = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startScale: this._scale,
      };
      this.container.classList.add('resizing');
      e.preventDefault();
      e.stopPropagation();
      document.addEventListener('mousemove', this._onResizeMove);
      document.addEventListener('mouseup', this._onResizeEnd);
    });
  }

  _onResizeMove(e) {
    if (!this._resizeState) return;
    const s = this._resizeState;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const avgDelta = (dx + dy) / 2;
    const minScale = 0.4;
    const maxScale = 2.5;
    const sensitivity = 0.003;
    this._scale = Math.max(minScale, Math.min(maxScale, s.startScale + avgDelta * sensitivity));
    this._applySize();
  }

  _onResizeEnd() {
    if (!this._resizeState) return;
    this.container.classList.remove('resizing');
    this._scale = Math.round(this._scale * 100) / 100;
    this._applySize();
    this._saveSize();
    this._resizeState = null;
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
  }

  _restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        this.container.style.left = saved.x + 'px';
        this.container.style.top = saved.y + 'px';
        this.container.style.right = 'auto';
        this.container.style.bottom = 'auto';
        this.container.style.transform = 'none';
      }
    } catch {}
  }

  _savePosition(x, y) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
  }

  _initDrag() {
    this._onDragMove = this._onDragMove.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);

    this.clockEl.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const rect = this.container.getBoundingClientRect();
      this.container.style.left = rect.left + 'px';
      this.container.style.top = rect.top + 'px';
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
      this.container.style.transform = 'none';
      this._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop: rect.top,
        moved: false,
      };
      this.container.classList.add('dragging');
      document.addEventListener('mousemove', this._onDragMove);
      document.addEventListener('mouseup', this._onDragEnd);
      e.preventDefault();
    });
  }

  _onDragMove(e) {
    if (!this._dragState) return;
    const s = this._dragState;
    const dx = Math.abs(e.clientX - s.startX);
    const dy = Math.abs(e.clientY - s.startY);
    if (dx > 3 || dy > 3) s.moved = true;
    if (!s.moved) return;
    this.container.style.transform = `translate(${e.clientX - s.startX}px, ${e.clientY - s.startY}px)`;
  }

  _onDragEnd() {
    if (!this._dragState) return;
    this.container.classList.remove('dragging');
    const s = this._dragState;
    if (s.moved) {
      const rect = this.container.getBoundingClientRect();
      this.container.style.transform = 'none';
      this.container.style.left = rect.left + 'px';
      this.container.style.top = rect.top + 'px';
      this._savePosition(rect.left, rect.top);
    } else {
      this.container.style.transform = 'none';
    }
    this._dragState = null;
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
  }

  update() {
    const now = new Date();
    const hour = now.getHours();
    this.timeEl.textContent = `${pad2(hour)}:${pad2(now.getMinutes())}`;
    this.dateEl.textContent = `${DAYS[now.getDay()]}, ${pad2(now.getDate())}/${MONTHS[now.getMonth()]}`;
    this._applyTimeMood(hour);
  }

  _applyTimeMood(hour) {
    let mood = 'clock-night';
    if (hour >= 5 && hour < 12) {
      mood = 'clock-morning';
    } else if (hour >= 12 && hour < 17) {
      mood = 'clock-afternoon';
    } else if (hour >= 17 && hour < 21) {
      mood = 'clock-evening';
    }

    if (mood === this._lastMood) return;
    this.container.classList.remove('clock-morning', 'clock-afternoon', 'clock-evening', 'clock-night');
    this.container.classList.add(mood);
    this._lastMood = mood;
  }

  startTicking(intervalMs = 60000) {
    this.stop();
    this.update();

    if (intervalMs !== 60000) {
      this._intervalId = setInterval(() => this.update(), intervalMs);
      return;
    }

    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    this._timeoutId = setTimeout(() => {
      this.update();
      this._timeoutId = null;
      this._intervalId = setInterval(() => this.update(), 60000);
    }, Math.max(250, msToNextMinute));
  }

  stop() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
