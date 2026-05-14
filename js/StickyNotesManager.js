import { STICKY_NOTES_KEY, DELETED_NOTES_KEY, uid, toast } from './utils.js';

const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'white', 'red', 'teal', 'brown', 'lavender', 'coral'];
const DEBOUNCE_MS = 600;
const DELETED_TTL = 300000;
const MIN_W = 200;
const MIN_H = 120;
const DEFAULT_W = 280;
const DEFAULT_H = 220;

export class StickyNotesManager {
  constructor() {
    this.notes = [];
    this.deletedNotes = [];
    this.zIndexCounter = 5;
    this._saveTimers = new Map();
    this._dragState = null;
    this._resizeState = null;
    this._focusedId = null;
  }

  async init() {
    await this._loadData();
    this._purgeExpiredDeleted();
    this._renderAll();
    this._renderDeletedSettings();
    this._wireGlobalEvents();
  }

  // ─── Persistence ──────────────────────────────

  async _loadData() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STICKY_NOTES_KEY, DELETED_NOTES_KEY], result => {
          this.notes = result[STICKY_NOTES_KEY] || [];
          this.deletedNotes = result[DELETED_NOTES_KEY] || [];
          resolve();
        });
      } else {
        try {
          const n = localStorage.getItem(STICKY_NOTES_KEY);
          const d = localStorage.getItem(DELETED_NOTES_KEY);
          if (n) this.notes = JSON.parse(n);
          if (d) this.deletedNotes = JSON.parse(d);
        } catch { /* ignore */ }
        resolve();
      }
    });
  }

  _saveNotes() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STICKY_NOTES_KEY]: this.notes });
    } else {
      localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(this.notes));
    }
  }

  _saveDeleted() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [DELETED_NOTES_KEY]: this.deletedNotes });
    } else {
      localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(this.deletedNotes));
    }
  }

  _purgeExpiredDeleted() {
    const now = Date.now();
    const before = this.deletedNotes.length;
    this.deletedNotes = this.deletedNotes.filter(d => now - d.deletedAt < DELETED_TTL);
    if (this.deletedNotes.length !== before) this._saveDeleted();
  }

  getDeletedNotes() {
    return this.deletedNotes;
  }

  // ─── CRUD ─────────────────────────────────────

  create(position) {
    if (!position) {
      const grid = document.getElementById('desktop-grid');
      const gridRect = grid.getBoundingClientRect();
      position = { x: gridRect.width / 2 - DEFAULT_W / 2, y: gridRect.height / 2 - DEFAULT_H / 2 };
    }
    const note = {
      id: uid(),
      type: 'note',
      title: '',
      content: '',
      position: { x: position.x, y: position.y },
      size: { w: DEFAULT_W, h: DEFAULT_H },
      color: 'yellow',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.notes.push(note);
    this._saveNotes();
    this._renderAll();
    const el = document.querySelector(`.sticky-note[data-id="${note.id}"]`);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.85)';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
        setTimeout(() => {
          el.style.transition = '';
          el.style.transform = '';
        }, 250);
      });
    }
    this._focusNote(note.id, el);
    return note;
  }

  delete(id) {
    const idx = this.notes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    const [removed] = this.notes.splice(idx, 1);
    this.deletedNotes.push({ note: removed, deletedAt: Date.now() });
    this._saveNotes();
    this._saveDeleted();

    const el = document.querySelector(`.sticky-note[data-id="${id}"]`);
    if (el) {
      el.style.transition = 'opacity 0.2s, transform 0.2s';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.85)';
      setTimeout(() => el.remove(), 200);
    }
    if (this._focusedId === id) this._focusedId = null;
    this._renderDeletedSettings();
    this._showUndoToast(removed);
    return removed;
  }

  _showUndoToast(note) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast undo';
    el.innerHTML = `Deleted <strong>${note.title || 'Sticky Note'}</strong> <button class="toast-undo">Undo</button>`;
    container.appendChild(el);
    el.querySelector('.toast-undo').addEventListener('click', () => {
      const dIdx = this.deletedNotes.findIndex(d => d.note.id === note.id);
      if (dIdx !== -1) {
        this.restoreDeleted(dIdx);
        el.remove();
      }
    });
    setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
  }

  restoreDeleted(index) {
    if (index < 0 || index >= this.deletedNotes.length) return;
    const entry = this.deletedNotes.splice(index, 1)[0];
    this.notes.push(entry.note);
    this._saveNotes();
    this._saveDeleted();
    this._renderAll();
    this._renderDeletedSettings();
    const el = document.querySelector(`.sticky-note[data-id="${entry.note.id}"]`);
    if (el) this._focusNote(entry.note.id, el);
    toast('Note restored', 'success');
  }

  clearDeleted() {
    this.deletedNotes = [];
    this._saveDeleted();
    this._renderDeletedSettings();
    toast('Deleted notes cleared', 'info');
  }

  clearAll() {
    this.notes = [];
    this.deletedNotes = [];
    this._saveNotes();
    this._saveDeleted();
    this._renderAll();
    this._renderDeletedSettings();
  }

  exportData() {
    return { stickyNotes: this.notes, deletedNotes: this.deletedNotes };
  }

  importData(data) {
    if (data.stickyNotes) this.notes = data.stickyNotes;
    if (data.deletedNotes) this.deletedNotes = data.deletedNotes;
    this._purgeExpiredDeleted();
    this._saveNotes();
    this._saveDeleted();
    this._renderAll();
    this._renderDeletedSettings();
  }

  // ─── Rendering ────────────────────────────────

  _renderAll() {
    const layer = document.getElementById('sticky-notes-layer');
    if (!layer) return;
    layer.innerHTML = '';
    this.notes.forEach(note => {
      layer.appendChild(this._createNoteElement(note));
    });
  }

  _createNoteElement(note) {
    const el = document.createElement('div');
    el.className = `sticky-note ${note.color}`;
    el.dataset.id = note.id;
    el.style.left = note.position.x + 'px';
    el.style.top = note.position.y + 'px';
    el.style.width = note.size.w + 'px';
    el.style.height = note.size.h + 'px';

    const header = document.createElement('div');
    header.className = 'sticky-note-header';

    const title = document.createElement('span');
    title.className = 'sticky-note-title';
    title.textContent = note.title || '';
    header.appendChild(title);

    const colorBtn = document.createElement('button');
    colorBtn.className = `sticky-note-color-btn ${note.color}`;
    colorBtn.title = 'Change color';
    colorBtn.innerHTML = '<span class="color-btn-dot"></span><i data-lucide="chevron-down" class="color-btn-arrow"></i>';
    colorBtn.addEventListener('mousedown', e => e.stopPropagation());
    colorBtn.addEventListener('click', e => {
      e.stopPropagation();
      this._toggleColorPicker(note.id, colorBtn);
    });
    header.appendChild(colorBtn);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [colorBtn] });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sticky-note-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Delete note';
    closeBtn.addEventListener('mousedown', e => e.stopPropagation());
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.delete(note.id);
    });
    header.appendChild(closeBtn);

    el.appendChild(header);

    const content = document.createElement('div');
    content.className = 'sticky-note-content';
    content.contentEditable = 'true';
    content.textContent = note.content;
    content.addEventListener('input', () => this._onContentInput(note.id));
    content.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    content.addEventListener('focus', () => this._focusNote(note.id, el));
    el.addEventListener('mousedown', e => {
      if (e.target === el) {
        this._bumpZIndex(note.id, el);
      }
    });
    el.appendChild(content);

    const resize = document.createElement('div');
    resize.className = 'sticky-note-resize';
    resize.addEventListener('mousedown', e => this._startResize(e, note.id));
    el.appendChild(resize);

    header.addEventListener('mousedown', e => {
      this._bumpZIndex(note.id, el);
      this._startDrag(e, note.id);
    });

    return el;
  }

  // ─── Content editing ──────────────────────────

  _onContentInput(id) {
    if (this._saveTimers.has(id)) {
      clearTimeout(this._saveTimers.get(id));
    }
    this._saveTimers.set(id, setTimeout(() => {
      this._saveTimers.delete(id);
      const note = this.notes.find(n => n.id === id);
      if (!note) return;
      const el = document.querySelector(`.sticky-note[data-id="${id}"]`);
      if (!el) return;
      const contentEl = el.querySelector('.sticky-note-content');
      const raw = contentEl.textContent || '';
      note.content = raw;
      const firstLine = raw.split('\n')[0].trim().substring(0, 50);
      note.title = firstLine || '';
      note.updatedAt = Date.now();
      this._saveNotes();
      const titleEl = el.querySelector('.sticky-note-title');
      if (titleEl) titleEl.textContent = note.title;
    }, DEBOUNCE_MS));
  }

  // ─── Color ────────────────────────────────────

  setColor(id, color) {
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    note.color = color;
    note.updatedAt = Date.now();
    this._saveNotes();
    const el = document.querySelector(`.sticky-note[data-id="${id}"]`);
    if (!el) return;
    NOTE_COLORS.forEach(c => el.classList.remove(c));
    el.classList.add(color);
    const btn = el.querySelector('.sticky-note-color-btn');
    if (btn) {
      NOTE_COLORS.forEach(c => btn.classList.remove(c));
      btn.classList.add(color);
    }
  }

  _toggleColorPicker(noteId, anchor) {
    const existing = document.querySelector('.sticky-note-color-picker');
    if (existing) {
      existing.remove();
      return;
    }
    const picker = document.createElement('div');
    picker.className = 'sticky-note-color-picker';
    NOTE_COLORS.forEach(c => {
      const swatch = document.createElement('span');
      swatch.className = `color-swatch ${c}`;
      swatch.addEventListener('click', e => {
        e.stopPropagation();
        this.setColor(noteId, c);
        picker.remove();
      });
      picker.appendChild(swatch);
    });
    document.body.appendChild(picker);

    const btnRect = anchor.getBoundingClientRect();
    picker.style.left = btnRect.left + 'px';
    picker.style.top = (btnRect.bottom + 4) + 'px';

    const closePicker = e => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('mousedown', closePicker);
      }
    };
    document.addEventListener('mousedown', closePicker);
  }

  // ─── Focus ────────────────────────────────────

  _bumpZIndex(id, el) {
    this._focusedId = id;
    this.zIndexCounter++;
    el.style.zIndex = this.zIndexCounter;
    document.querySelectorAll('.sticky-note.focused').forEach(e => e.classList.remove('focused'));
    el.classList.add('focused');
  }

  _focusNote(id, el) {
    this._bumpZIndex(id, el);
    const contentEl = el.querySelector('.sticky-note-content');
    if (contentEl && document.activeElement !== contentEl) {
      contentEl.focus();
      const range = document.createRange();
      range.selectNodeContents(contentEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  blurActive() {
    if (document.activeElement && document.activeElement.classList.contains('sticky-note-content')) {
      document.activeElement.blur();
    }
    document.querySelectorAll('.sticky-note.focused').forEach(e => e.classList.remove('focused'));
    this._focusedId = null;
  }

  isNoteFocused() {
    return this._focusedId !== null;
  }

  // ─── Drag ─────────────────────────────────────

  _startDrag(e, id) {
    if (e.button !== 0) return;
    const el = e.currentTarget.closest('.sticky-note');
    if (!el) return;
    this._dragState = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: parseInt(el.style.left, 10),
      origTop: parseInt(el.style.top, 10),
    };
    el.classList.add('dragging');
    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup', this._onDragEnd);
    e.preventDefault();
  }

  _onDragMove = e => {
    if (!this._dragState) return;
    const s = this._dragState;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const el = document.querySelector(`.sticky-note[data-id="${s.id}"]`);
    if (el) {
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  _onDragEnd = e => {
    if (!this._dragState) return;
    const s = this._dragState;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3;
    const el = document.querySelector(`.sticky-note[data-id="${s.id}"]`);
    if (el) {
      el.classList.remove('dragging');
      if (moved) {
        const layerRect = document.getElementById('sticky-notes-layer').getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const rawX = Math.max(0, elRect.left - layerRect.left);
        const rawY = Math.max(0, elRect.top - layerRect.top);
        el.style.transform = '';
        el.style.left = rawX + 'px';
        el.style.top = rawY + 'px';
        const note = this.notes.find(n => n.id === s.id);
        if (note) {
          note.position.x = rawX;
          note.position.y = rawY;
          note.updatedAt = Date.now();
          this._saveNotes();
        }
      } else {
        el.style.transform = '';
      }
    }
    this._dragState = null;
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
  };

  // ─── Resize ───────────────────────────────────

  _startResize(e, id) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = document.querySelector(`.sticky-note[data-id="${id}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this._resizeState = { id, startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height };
    el.classList.add('resizing');
    document.addEventListener('mousemove', this._onResizeMove);
    document.addEventListener('mouseup', this._onResizeEnd);
  }

  _onResizeMove = e => {
    if (!this._resizeState) return;
    const s = this._resizeState;
    let w = s.startW + (e.clientX - s.startX);
    let h = s.startH + (e.clientY - s.startY);
    w = Math.max(MIN_W, Math.round(w));
    h = Math.max(MIN_H, Math.round(h));
    const el = document.querySelector(`.sticky-note[data-id="${s.id}"]`);
    if (el) {
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    }
  };

  _onResizeEnd = () => {
    if (!this._resizeState) return;
    const s = this._resizeState;
    const el = document.querySelector(`.sticky-note[data-id="${s.id}"]`);
    if (el) el.classList.remove('resizing');
    const note = this.notes.find(n => n.id === s.id);
    if (note && el) {
      note.size.w = parseInt(el.style.width, 10);
      note.size.h = parseInt(el.style.height, 10);
      note.updatedAt = Date.now();
      this._saveNotes();
    }
    this._resizeState = null;
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup', this._onResizeEnd);
  };

  // ─── Settings: Recently Deleted ───────────────

  renderDeletedSettings() {
    this._renderDeletedSettings();
  }

  _renderDeletedSettings() {
    const container = document.getElementById('deleted-notes-container');
    if (!container) return;
    container.innerHTML = '';
    if (this.deletedNotes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'settings-info dim';
      empty.textContent = 'No recently deleted notes.';
      container.appendChild(empty);
      return;
    }
    this.deletedNotes.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'deleted-note-row';
      const note = entry.note;
      const age = Math.round((Date.now() - entry.deletedAt) / 60000);

      const dot = document.createElement('span');
      dot.className = `deleted-note-color ${note.color}`;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'deleted-note-title';
      titleSpan.textContent = note.title || 'Untitled';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'deleted-note-time';
      timeSpan.textContent = `${age} min ago`;

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'deleted-note-restore';
      restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', () => this.restoreDeleted(i));

      row.appendChild(dot);
      row.appendChild(titleSpan);
      row.appendChild(timeSpan);
      row.appendChild(restoreBtn);
      container.appendChild(row);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'settings-btn';
    clearBtn.style.marginTop = '8px';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', () => this.clearDeleted());
    container.appendChild(clearBtn);
  }

  // ─── Global events ────────────────────────────

  _wireGlobalEvents() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._focusedId) {
        this.blurActive();
        e.preventDefault();
      }
    });
  }
}
