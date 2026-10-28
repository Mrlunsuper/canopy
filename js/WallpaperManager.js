/* ============================================================
   CANOPY — js/WallpaperManager.js
   Wallpaper management
   ============================================================ */

export class WallpaperManager {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   */
  constructor(storage) {
    this.storage = storage;
    /** @type {HTMLImageElement|null} */
    this._preloadImg = null;

    /** @type {Record<string, string>} */
    this.classMap = {
      default:  '',
      aurora:   'wallpaper-aurora',
      sunset:   'wallpaper-sunset',
      rose:     'wallpaper-rose',
      forest:   'wallpaper-forest',
      desert:   'wallpaper-desert',
      midnight: 'wallpaper-midnight',
      neon:     'wallpaper-neon',
      candy:    'wallpaper-candy',
      arctic:   'wallpaper-arctic',
      lava:     'wallpaper-lava',
      teal:     'wallpaper-teal',
      sakura:   'wallpaper-sakura',
      cosmic:   'wallpaper-cosmic',
      copper:   'wallpaper-copper',
      slate:    'wallpaper-slate',
      jungle:   'wallpaper-jungle',
      galaxy:   'wallpaper-galaxy',
    };
  }

  /**
   * Apply a wallpaper (preset name, data-URL, or HTTP URL).
   * @param {string} wp
   */
  apply(wp) {
    const desktop = document.getElementById('desktop');

    // cancel pending image preload
    if (this._preloadImg) {
      this._preloadImg.onload = null;
      this._preloadImg.onerror = null;
      this._preloadImg = null;
    }

    // remove all wallpaper classes
    desktop.classList.remove(
      ...Object.values(this.classMap).filter(Boolean),
      'wallpaper-custom',
      'wallpaper-loading'
    );

    if (wp.startsWith('data:')) {
      desktop.style.backgroundImage = `url('${wp}')`;
      desktop.classList.add('wallpaper-custom');
    } else if (wp.startsWith('http')) {
      // Preload first to avoid flash, then swap in
      desktop.classList.add('wallpaper-loading');
      this._preloadImg = new Image();
      this._preloadImg.onload = () => {
        desktop.style.backgroundImage = `url('${wp}')`;
        desktop.classList.remove('wallpaper-loading');
        desktop.classList.add('wallpaper-custom');
        this._preloadImg = null;
      };
      this._preloadImg.onerror = () => {
        desktop.classList.remove('wallpaper-loading');
        this._preloadImg = null;
      };
      this._preloadImg.src = wp;
    } else {
      desktop.style.backgroundImage = '';
      if (this.classMap[wp]) {
        desktop.classList.add(this.classMap[wp]);
      }
    }

    // update preset UI
    document.querySelectorAll('.wp-preset').forEach(el => {
      el.classList.toggle('active', el.dataset.wp === wp);
    });
  }

  /**
   * Apply and persist a wallpaper.
   * @param {string} wp
   */
  set(wp) {
    this.apply(wp);
    this.storage.saveWallpaper(wp);
  }

  /**
   * Downscale an uploaded data-URL image to fit within maxDim.
   * Keeps storage use small to avoid chrome.storage quota errors.
   * Preserves transparency (PNG) when the source has an alpha channel.
   * @param {string} dataUrl
   * @param {number} [maxDim=1920]
   * @param {number} [quality=0.85]
   * @returns {Promise<string>}
   */
  _downscaleImage(dataUrl, maxDim = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          if (scale >= 1 && dataUrl.startsWith('data:image/png')) { resolve(dataUrl); return; }
          resolve(this._hasAlpha(canvas) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /** @private — sample pixels to detect a real alpha channel */
  _hasAlpha(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      const stepX = Math.max(1, Math.floor(width / 40));
      const stepY = Math.max(1, Math.floor(height / 40));
      for (let y = 0; y < height; y += stepY) {
        const row = ctx.getImageData(0, y, width, 1).data;
        for (let x = 3; x < row.length; x += stepX * 4) {
          if (row[x] < 255) return true;
        }
      }
    } catch { /* tainted canvas — treat as opaque */ }
    return false;
  }

  /**
   * Apply an uploaded image (downscales before persist).
   * @param {string} dataUrl
   * @returns {Promise<void>}
   */
  async setUpload(dataUrl) {
    const finalUrl = await this._downscaleImage(dataUrl);
    if (finalUrl.length > 4 * 1024 * 1024) {
      throw new Error('Image still too large after compression');
    }
    this.set(finalUrl);
  }
}
