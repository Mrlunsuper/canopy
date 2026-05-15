/* ============================================================
   CANOPY — js/ClockWidget.js
   Clock display widget
   ============================================================ */

import { DAYS, MONTHS, pad2 } from './utils.js';

const STORAGE_KEY = 'canopy_clock_position';

export class ClockWidget {
  constructor() {
    this.container = document.getElementById('center-widget');
    this.clockEl = document.getElementById('taskbar-clock');
    this.timeEl = document.getElementById('clock-time');
    this.dateEl = document.getElementById('clock-date');
    this._intervalId = null;
    this._dragState = null;
    this._restorePosition();
    this._initDrag();
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
    this.container.classList.remove('clock-morning', 'clock-afternoon', 'clock-evening', 'clock-night');

    if (hour >= 5 && hour < 12) {
      this.container.classList.add('clock-morning');
    } else if (hour >= 12 && hour < 17) {
      this.container.classList.add('clock-afternoon');
    } else if (hour >= 17 && hour < 21) {
      this.container.classList.add('clock-evening');
    } else {
      this.container.classList.add('clock-night');
    }
  }

  startTicking(intervalMs = 10000) {
    this.update();
    this._intervalId = setInterval(() => this.update(), intervalMs);
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
