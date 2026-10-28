import { toast } from './utils.js';

const CP_HISTORY_KEY = 'canopy_cp_history';
const CP_HISTORY_MAX = 20;

export class CommandPalette {
  constructor(wallhavenManager, storage = null, onOpenItem = null) {
    this.wallhaven = wallhavenManager;
    this.storage = storage;
    this.onOpenItem = onOpenItem;
    this.overlay    = document.getElementById('command-palette');
    this.input      = document.getElementById('cp-input');
    this.results    = document.getElementById('cp-results');
    this.resultList = document.getElementById('cp-result-list');
    this.activeCommand = null;
    this._selectables = [];
    this._activeIndex = -1;
  }

  get visible() {
    return !this.overlay.classList.contains('hidden');
  }

  show() {
    if (this.overlay.classList.contains('closing')) return;
    this.overlay.classList.remove('hidden', 'closing');
    this.input.value = '';
    this.activeCommand = null;
    this._selectables = [];
    this._activeIndex = -1;
    this._showHelp();
    requestAnimationFrame(() => this.input.focus());
  }

  hide() {
    if (this.overlay.classList.contains('hidden')) return;
    this.overlay.classList.add('closing');
    this.overlay.addEventListener('animationend', () => {
      this.overlay.classList.remove('closing');
      this.overlay.classList.add('hidden');
    }, { once: true });
  }

  handleInput() {
    const value = this.input.value.trim();
    this.results.classList.add('hidden');
    this.activeCommand = null;
    this._selectables = [];
    this._activeIndex = -1;

    if (!value) {
      this._showHelp();
      return;
    }

    const parts = value.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    if (cmd === '/help' || cmd === '/?') {
      this.activeCommand = 'help';
      this._showHelp();
      return;
    }

    if (cmd === '/gg') {
      this.activeCommand = 'gg';
      if (rest) this._showSearchPreview('google', `Search Google for "${rest}"`, rest, () => this.execute());
      return;
    }

    if (cmd === '/yt') {
      this.activeCommand = 'yt';
      if (rest) this._showSearchPreview('youtube', `Search YouTube for "${rest}"`, rest, () => this.execute());
      return;
    }

    if (cmd === '/cal') {
      this.activeCommand = 'cal';
      if (rest) this._tryShowCalc(rest);
      return;
    }

    if (cmd === '/wall') {
      this.activeCommand = 'wall';
      if (rest) this._showSearchPreview('image', `Search Wallhaven for "${rest}"`, rest, () => this.execute());
      return;
    }

    if (cmd.startsWith('/')) {
      this._showSearchPreview('circle-help', `Unknown command "${cmd}" — try /help`, '', null);
      return;
    }

    // Plain text → search desktop shortcuts + folders
    this.activeCommand = 'local';
    this._showLocalResults(value);
  }

  execute() {
    // Keyboard selection wins: activate highlighted result first
    if (this._selectables.length > 0 && this._activeIndex >= 0) {
      const chosen = this._selectables[this._activeIndex];
      if (chosen) { chosen.click(); return; }
    }
    const value = this.input.value.trim();
    if (!value) return;

    const parts = value.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    if (cmd === '/help' || cmd === '/?') {
      this._showHelp();
      return;
    }

    if (cmd === '/gg' && rest) {
      this._pushHistory(value);
      window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(rest);
      return;
    }

    if (cmd === '/yt' && rest) {
      this._pushHistory(value);
      window.location.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(rest);
      return;
    }

    if (cmd === '/cal' && rest) {
      const result = this._evalCalc(rest);
      if (result !== null) {
        this._pushHistory(value);
        toast(`= ${result}`, 'success');
        this.hide();
      } else {
        toast('Invalid expression', 'error');
      }
      return;
    }

    if (cmd === '/wall' && rest) {
      this._pushHistory(value);
      this.wallhaven.open();
      document.getElementById('wh-modal-query').value = rest;
      this.wallhaven.search(rest);
      this.hide();
      return;
    }

    if (cmd.startsWith('/')) {
      if (!['/help', '/?', '/gg', '/yt', '/cal', '/wall'].includes(cmd)) {
        toast(`Unknown command "${cmd}". Try /help.`, 'error');
      }
      return;
    }

    if (!cmd.startsWith('/')) {
      // Plain text: open first local match, if any
      const matches = this._searchLocal(value);
      if (matches.length > 0) {
        this._pushHistory(value);
        this.hide();
        if (this.onOpenItem) this.onOpenItem(matches[0]);
        return;
      }
      // No local match → fall back to Google search
      this._pushHistory(value);
      window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(value);
      return;
    }
  }

  // ─── Local search + help + history ────────────

  /** @private */
  _searchLocal(query, limit = 8) {
    if (!this.storage || !query) return [];
    const q = query.toLowerCase();
    const out = [];
    const walk = items => {
      for (const item of items) {
        const hay = `${item.title || ''} ${item.url || ''}`.toLowerCase();
        if (hay.includes(q)) {
          out.push(item);
          if (out.length >= limit) return;
        }
        if (item.children?.length) walk(item.children);
        if (out.length >= limit) return;
      }
    };
    walk(this.storage.data.items || []);
    return out;
  }

  /** @private */
  _showLocalResults(query) {
    const matches = this._searchLocal(query);
    this.results.classList.remove('hidden');
    this.resultList.innerHTML = '';
    this._selectables = [];
    this._activeIndex = -1;

    if (matches.length === 0) {
      this._showSearchPreview('google', `No shortcut matches — Enter searches Google for "${query}"`, query, () => this.execute());
      return;
    }

    matches.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'cp-result-item';
      el.setAttribute('role', 'option');

      const icon = document.createElement('span');
      icon.className = 'cp-result-icon';
      const glyph = document.createElement('i');
      glyph.dataset.lucide = item.type === 'folder' ? 'folder' : 'link';
      icon.appendChild(glyph);

      const label = document.createElement('span');
      label.className = 'cp-result-label';
      label.textContent = item.title || item.url || 'Shortcut';

      el.append(icon, label);
      el.addEventListener('click', () => {
        this._pushHistory(query);
        this.hide();
        if (this.onOpenItem) this.onOpenItem(item);
      });
      this.resultList.appendChild(el);
      this._selectables.push(el);
      if (idx === 0) this._setActive(0, false);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.resultList });
  }

  /** @private */
  _showHelp() {
    this.results.classList.remove('hidden');
    this.resultList.innerHTML = '';
    this._selectables = [];
    this._activeIndex = -1;

    const commands = [
      ['search', 'Type to search your shortcuts — Enter opens the first match'],
      ['google', '/gg {term} — Google search'],
      ['youtube', '/yt {term} — YouTube search'],
      ['equal', '/cal {expr} — Calculator (copy with the button)'],
      ['image', '/wall {term} — Search Wallhaven wallpapers'],
    ];
    commands.forEach(([iconName, text]) => {
      const el = document.createElement('div');
      el.className = 'cp-result-item';
      const icon = document.createElement('span');
      icon.className = 'cp-result-icon';
      const glyph = document.createElement('i');
      glyph.dataset.lucide = iconName;
      icon.appendChild(glyph);
      const label = document.createElement('span');
      label.className = 'cp-result-label';
      label.textContent = text;
      el.append(icon, label);
      this.resultList.appendChild(el);
    });

    const history = this._loadHistory();
    if (history.length > 0) {
      const head = document.createElement('div');
      head.className = 'cp-result-item';
      head.innerHTML = '<span class="cp-result-label">Recent</span>';
      this.resultList.appendChild(head);
      history.slice(0, 5).forEach(h => {
        const el = document.createElement('div');
        el.className = 'cp-result-item';
        const icon = document.createElement('span');
        icon.className = 'cp-result-icon';
        const glyph = document.createElement('i');
        glyph.dataset.lucide = 'history';
        icon.appendChild(glyph);
        const label = document.createElement('span');
        label.className = 'cp-result-label';
        label.textContent = h;
        el.append(icon, label);
        el.addEventListener('click', () => {
          this.input.value = h;
          this.handleInput();
          this.input.focus();
        });
        this.resultList.appendChild(el);
        this._selectables.push(el);
      });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.resultList });
  }

  /** @private */
  _loadHistory() {
    try {
      const raw = localStorage.getItem(CP_HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
    } catch { return []; }
  }

  /** @private */
  _pushHistory(entry) {
    try {
      const arr = [entry, ...this._loadHistory().filter(x => x !== entry)].slice(0, CP_HISTORY_MAX);
      localStorage.setItem(CP_HISTORY_KEY, JSON.stringify(arr));
    } catch { /* ignore */ }
  }

  /** @private */
  _setActive(index, focus = true) {
    this._selectables.forEach((el, i) => el.classList.toggle('active', i === index));
    this._activeIndex = index;
    if (focus) this._selectables[index]?.scrollIntoView({ block: 'nearest' });
  }

  /** @private */
  _moveActive(delta) {
    if (this._selectables.length === 0) return;
    const next = this._activeIndex < 0
      ? (delta > 0 ? 0 : this._selectables.length - 1)
      : (this._activeIndex + delta + this._selectables.length) % this._selectables.length;
    this._setActive(next);
  }

  _showSearchPreview(iconName, text, query, onActivate = null) {
    this.results.classList.remove('hidden');
    this.resultList.innerHTML = '';
    this._selectables = [];
    this._activeIndex = -1;

    const el = document.createElement('div');
    el.className = 'cp-result-item';

    const icon = document.createElement('span');
    icon.className = 'cp-result-icon';
    const glyph = document.createElement('i');
    glyph.dataset.lucide = iconName;
    icon.appendChild(glyph);

    const label = document.createElement('span');
    label.className = 'cp-result-label';
    label.textContent = text;

    el.append(icon, label);
    if (onActivate) {
      el.style.cursor = 'pointer';
      el.classList.add('active');
      el.addEventListener('click', onActivate);
    }
    this.resultList.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  }

  _tryShowCalc(expr) {
    const result = this._evalCalc(expr);
    if (result === null) return;

    this.results.classList.remove('hidden');
    this.resultList.innerHTML = '';

    const el = document.createElement('div');
    el.className = 'cp-result-item cp-calc-result';

    const icon = document.createElement('span');
    icon.className = 'cp-result-icon';
    const equalIcon = document.createElement('i');
    equalIcon.dataset.lucide = 'equal';
    icon.appendChild(equalIcon);

    const body = document.createElement('div');
    body.className = 'cp-calc-body';
    body.innerHTML = `
      <div class="cp-calc-expr">${this._escapeHtml(expr)}</div>
      <div class="cp-calc-answer">${result}</div>
    `;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cp-copy-btn';
    copyBtn.title = 'Copy result';
    const copyIcon = document.createElement('i');
    copyIcon.dataset.lucide = 'copy';
    copyBtn.appendChild(copyIcon);
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(String(result)).catch(() => {});
      toast('Copied', 'success');
    });

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(copyBtn);
    this.resultList.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  }

  _evalCalc(expr) {
    if (!expr) return null;
    try {
      const tokens = this._tokenize(expr);
      if (!tokens) return null;
      const result = this._parse(tokens);
      if (typeof result === 'number' && isFinite(result)) {
        return Number.isInteger(result) ? result : +result.toFixed(6);
      }
    } catch {}
    return null;
  }

  _tokenize(expr) {
    const regex = /(\d+(?:\.\d+)?|[a-zA-Z_]\w*|[+\-*/()^,])/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(expr)) !== null) {
      tokens.push(match[1]);
    }
    if (tokens.length === 0) return null;
    return tokens;
  }

  _parse(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const parseAddSub = () => {
      let left = parseMulDiv();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseMulDiv();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseMulDiv = () => {
      let left = parsePow();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const right = parsePow();
        if (op === '*') {
          left = left * right;
        } else {
          if (right === 0) throw new Error('div by zero');
          left = left / right;
        }
      }
      return left;
    };

    const parsePow = () => {
      let left = parseUnary();
      if (peek() === '^') {
        consume();
        const right = parsePow();
        left = Math.pow(left, right);
      }
      return left;
    };

    const parseUnary = () => {
      if (peek() === '-') {
        consume();
        return -parseUnary();
      }
      if (peek() === '+') {
        consume();
        return parseUnary();
      }
      return parseAtom();
    };

    const parseAtom = () => {
      if (peek() === '(') {
        consume();
        const val = parseAddSub();
        if (peek() !== ')') throw new Error('missing )');
        consume();
        return val;
      }
      if (peek() && /^\d+(\.\d+)?$/.test(peek())) {
        return parseFloat(consume());
      }
      if (peek() === 'PI' || peek() === 'pi') {
        consume();
        return Math.PI;
      }
      if (peek() === 'E' || peek() === 'e') {
        consume();
        return Math.E;
      }
      const funcs = ['sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'floor', 'ceil', 'round', 'pow', 'max', 'min'];
      if (peek() && funcs.includes(peek().toLowerCase())) {
        const name = consume().toLowerCase();
        if (peek() !== '(') throw new Error('expected (');
        consume();
        const args = [parseAddSub()];
        while (peek() === ',') {
          consume();
          args.push(parseAddSub());
        }
        if (peek() !== ')') throw new Error('missing )');
        consume();
        switch (name) {
          case 'sqrt': return Math.sqrt(args[0]);
          case 'abs': return Math.abs(args[0]);
          case 'sin': return Math.sin(args[0]);
          case 'cos': return Math.cos(args[0]);
          case 'tan': return Math.tan(args[0]);
          case 'log': return Math.log(args[0]);
          case 'floor': return Math.floor(args[0]);
          case 'ceil': return Math.ceil(args[0]);
          case 'round': return Math.round(args[0]);
          case 'pow': return Math.pow(args[0], args[1]);
          case 'max': return Math.max(...args);
          case 'min': return Math.min(...args);
        }
      }
      throw new Error('unexpected token: ' + peek());
    };

    return parseAddSub();
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  wireEvents() {
    this.input.addEventListener('input', () => this.handleInput());

    this.input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._moveActive(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._moveActive(-1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.execute();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });

    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.hide();
    });
  }
}
