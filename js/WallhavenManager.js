import { toast } from './utils.js';

const WH_API = 'https://wallhaven.cc/api/v1/search';

export class WallhavenManager {
  constructor(wallpaperManager) {
    this.wallpaper = wallpaperManager;
    this.results = [];
    this.currentQuery = '';
    this.currentPage = 1;
    this.lastPage = 1;
    this.total = 0;
    this.previewWp = null;
    this.previewIndex = -1;
  }

  open() {
    const modal = document.getElementById('wallhaven-modal');
    modal.classList.remove('hidden');
    const input = document.getElementById('wh-modal-query');
    input.value = '';
    document.getElementById('wh-modal-status').textContent = '';
    document.getElementById('wh-modal-results').innerHTML = '';
    document.getElementById('wh-modal-pagination').classList.add('hidden');
    this.results = [];
    this.currentQuery = '';
    this.currentPage = 1;
    this.lastPage = 1;
    this.total = 0;
    setTimeout(() => input.focus(), 80);
  }

  close() {
    const modal = document.getElementById('wallhaven-modal');
    if (!modal || modal.classList.contains('hidden') || modal.classList.contains('closing')) return;

    modal.classList.add('closing');
    modal.addEventListener('animationend', () => {
      modal.classList.remove('closing');
      modal.classList.add('hidden');
    }, { once: true });
  }

  async search(query, page = 1) {
    const q = query.trim();
    if (!q) return;

    this.currentQuery = q;
    this.currentPage = page;

    const params = new URLSearchParams({
      q,
      categories: '111',
      purity: '100',
      sorting: 'relevance',
      atleast: '1920x1080',
      page: String(page),
    });

    this._setStatus('Searching...');

    try {
      let json;

      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        json = await this._fetchViaWorker(`${WH_API}?${params}`);
      } else {
        const res = await fetch(`${WH_API}?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      }

      this.results = json.data || [];
      this.lastPage = json.meta?.last_page || 1;
      this.total = json.meta?.total || 0;
      this._render();
      this._renderPagination();
      this._setStatus(this.total
        ? `Page ${this.currentPage} of ${this.lastPage} — ${this.total.toLocaleString()} wallpapers`
        : 'No results found');

      document.getElementById('wh-modal-results').scrollTop = 0;
    } catch (err) {
      this._setStatus('Search failed');
      toast(`Wallhaven: ${err.message}`, 'error');
    }
  }

  _fetchViaWorker(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'wallhaven-search', url },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response?.ok) {
            reject(new Error(response?.error || 'No response from background worker'));
          } else {
            resolve(response.data);
          }
        }
      );
    });
  }

  apply(wp) {
    this.wallpaper.set(this._getImageUrl(wp));
    toast(`Wallpaper set: ${wp.id}`, 'success');
  }

  download(wp) {
    const url = this._getImageUrl(wp);
    const ext = (wp.file_type || 'jpg').split('/').pop();
    const filename = `wallhaven-${wp.id}.${ext}`;

    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'wallhaven-download',
        url,
        filename
      }, response => {
        if (chrome.runtime.lastError || !response?.ok) {
          toast(`Download failed: ${chrome.runtime.lastError?.message || response?.error || 'Unknown error'}`, 'error');
          return;
        }
        toast(`Downloading ${filename}...`, 'success');
      });
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast(`Download started`, 'success');
    }
  }

  preview(wp) {
    this.previewWp = wp;
    this.previewIndex = this.results.findIndex(r => r.id === wp.id);

    this._showPreview();
  }

  nextPreview() {
    if (this.previewIndex < this.results.length - 1) {
      this.previewIndex++;
      this.previewWp = this.results[this.previewIndex];
      this._showPreview();
    }
  }

  prevPreview() {
    if (this.previewIndex > 0) {
      this.previewIndex--;
      this.previewWp = this.results[this.previewIndex];
      this._showPreview();
    }
  }

  hasNextPreview() { return this.previewIndex < this.results.length - 1; }
  hasPrevPreview() { return this.previewIndex > 0; }

  _showPreview() {
    const wp = this.previewWp;

    const img = document.getElementById('wh-preview-img');
    img.src = this._getImageUrl(wp);

    document.getElementById('wh-preview-id').textContent = `#${wp.id}`;
    document.getElementById('wh-preview-res').textContent = wp.resolution || '';

    const prevBtn = document.getElementById('wh-preview-prev');
    const nextBtn = document.getElementById('wh-preview-next');
    prevBtn.classList.toggle('hidden', !this.hasPrevPreview());
    nextBtn.classList.toggle('hidden', !this.hasNextPreview());

    const overlay = document.getElementById('wh-preview');
    overlay.classList.remove('hidden', 'closing');

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [overlay] });
  }

  closePreview() {
    const overlay = document.getElementById('wh-preview');
    if (!overlay || overlay.classList.contains('hidden') || overlay.classList.contains('closing')) return;

    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => {
      overlay.classList.remove('closing');
      overlay.classList.add('hidden');
    }, { once: true });
  }

  _getImageUrl(wp) {
    if (wp.path && wp.path.includes('w.wallhaven.cc/full')) return wp.path;

    const ext = (wp.file_type || 'jpg').split('/').pop();
    const first2 = wp.id.substring(0, 2);
    return `https://w.wallhaven.cc/full/${first2}/wallhaven-${wp.id}.${ext}`;
  }

  _setStatus(msg) {
    const el = document.getElementById('wh-modal-status');
    if (el) el.textContent = msg;
  }

  _render() {
    const container = document.getElementById('wh-modal-results');
    if (!container) return;
    container.innerHTML = '';

    for (const wp of this.results) {
      const card = document.createElement('div');
      card.className = 'wh-modal-card';

      const img = document.createElement('img');
      img.src = wp.thumbs?.small || '';
      img.alt = wp.id || 'Wallpaper preview';
      img.loading = 'lazy';

      const actions = document.createElement('div');
      actions.className = 'wh-modal-actions';

      const setBtn = document.createElement('button');
      setBtn.className = 'wh-action-btn wh-action-set';
      setBtn.title = 'Set as wallpaper';
      setBtn.appendChild(this._icon('monitor'));

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'wh-action-btn wh-action-dl';
      downloadBtn.title = 'Download';
      downloadBtn.appendChild(this._icon('download'));

      actions.append(setBtn, downloadBtn);

      const info = document.createElement('div');
      info.className = 'wh-modal-info';

      const size = document.createElement('span');
      size.className = 'wh-modal-size';
      size.textContent = wp.resolution || '';
      info.appendChild(size);

      card.append(img, actions, info);

      setBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.apply(wp);
      });

      downloadBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.download(wp);
      });

      card.addEventListener('click', () => {
        this.preview(wp);
      });

      container.appendChild(card);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
  }

  _icon(name) {
    const icon = document.createElement('i');
    icon.dataset.lucide = name;
    return icon;
  }

  _renderPagination() {
    const pagination = document.getElementById('wh-modal-pagination');
    if (this.lastPage <= 1) {
      pagination.classList.add('hidden');
      return;
    }

    pagination.classList.remove('hidden');

    document.getElementById('wh-page-indicator').textContent =
      `Page ${this.currentPage} of ${this.lastPage}`;

    const prevBtn = document.getElementById('wh-prev-btn');
    const nextBtn = document.getElementById('wh-next-btn');

    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= this.lastPage;

    prevBtn.onclick = () => {
      if (this.currentPage > 1) this.search(this.currentQuery, this.currentPage - 1);
    };
    nextBtn.onclick = () => {
      if (this.currentPage < this.lastPage) this.search(this.currentQuery, this.currentPage + 1);
    };

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [pagination] });
  }
}
