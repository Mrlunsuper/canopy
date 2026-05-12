import { toast } from './utils.js';

export class CommandPalette {
  constructor(wallhavenManager) {
    this.wallhaven = wallhavenManager;
    this.overlay    = document.getElementById('command-palette');
    this.input      = document.getElementById('cp-input');
    this.results    = document.getElementById('cp-results');
    this.resultList = document.getElementById('cp-result-list');
    this.activeCommand = null;
  }

  get visible() {
    return !this.overlay.classList.contains('hidden');
  }

  show() {
    if (this.overlay.classList.contains('closing')) return;
    this.overlay.classList.remove('hidden', 'closing');
    this.input.value = '';
    this.results.classList.add('hidden');
    this.activeCommand = null;
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

    if (!value) return;

    const parts = value.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    if (cmd === '/gg') {
      this.activeCommand = 'gg';
      if (rest) this._showSearchPreview('google', `Search Google for "${rest}"`, rest);
      return;
    }

    if (cmd === '/yt') {
      this.activeCommand = 'yt';
      if (rest) this._showSearchPreview('youtube', `Search YouTube for "${rest}"`, rest);
      return;
    }

    if (cmd === '/cal') {
      this.activeCommand = 'cal';
      if (rest) this._tryShowCalc(rest);
      return;
    }

    if (cmd === '/wall') {
      this.activeCommand = 'wall';
      if (rest) this._showSearchPreview('image', `Search Wallhaven for "${rest}"`, rest);
      return;
    }
  }

  execute() {
    const value = this.input.value.trim();
    if (!value) return;

    const parts = value.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    if (cmd === '/gg' && rest) {
      window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(rest);
      return;
    }

    if (cmd === '/yt' && rest) {
      window.location.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(rest);
      return;
    }

    if (cmd === '/cal' && rest) {
      const result = this._evalCalc(rest);
      if (result !== null) {
        navigator.clipboard.writeText(String(result)).catch(() => {});
        toast(`= ${result} (copied)`, 'success');
        this.hide();
      } else {
        toast('Invalid expression', 'error');
      }
      return;
    }

    if (cmd === '/wall' && rest) {
      this.wallhaven.open();
      document.getElementById('wh-modal-query').value = rest;
      this.wallhaven.search(rest);
      this.hide();
      return;
    }
  }

  _showSearchPreview(iconName, text, query) {
    this.results.classList.remove('hidden');
    this.resultList.innerHTML = '';

    const el = document.createElement('div');
    el.className = 'cp-result-item';
    el.innerHTML = `
      <span class="cp-result-icon"><i data-lucide="${iconName}" style="width:16px;height:16px"></i></span>
      <span class="cp-result-label">${this._escapeHtml(text)}</span>
    `;
    this.resultList.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [el] });
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
    icon.innerHTML = '<i data-lucide="equal" style="width:16px;height:16px"></i>';

    const body = document.createElement('div');
    body.className = 'cp-calc-body';
    body.innerHTML = `
      <div class="cp-calc-expr">${this._escapeHtml(expr)}</div>
      <div class="cp-calc-answer">= ${result}</div>
    `;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cp-copy-btn';
    copyBtn.title = 'Copy result';
    copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(String(result)).catch(() => {});
      toast('Copied: ' + result, 'success');
    });

    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(copyBtn);
    this.resultList.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [el] });
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
