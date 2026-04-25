/* ============================================================
   CANOPY — js/ClockWidget.js
   Clock display widget
   ============================================================ */

import { DAYS, MONTHS, pad2 } from './utils.js';

export class ClockWidget {
  constructor() {
    this.timeEl = document.getElementById('clock-time');
    this.dateEl = document.getElementById('clock-date');
    this._intervalId = null;
  }

  /**
   * Update clock display with current time.
   */
  update() {
    const now = new Date();
    this.timeEl.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    this.dateEl.textContent = `${DAYS[now.getDay()]}, ${pad2(now.getDate())}/${MONTHS[now.getMonth()]}`;
  }

  /**
   * Start the clock, updating at the given interval.
   * @param {number} [intervalMs=10000]
   */
  startTicking(intervalMs = 10000) {
    this.update();
    this._intervalId = setInterval(() => this.update(), intervalMs);
  }

  /**
   * Stop the clock interval.
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
