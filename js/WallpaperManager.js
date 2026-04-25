/* ============================================================
   CANOPY — js/WallpaperManager.js
   Wallpaper theme management
   ============================================================ */

export class WallpaperManager {
  /**
   * @param {import('./StorageManager.js').StorageManager} storage
   */
  constructor(storage) {
    this.storage = storage;

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

    // remove all wallpaper classes
    desktop.classList.remove(
      ...Object.values(this.classMap).filter(Boolean),
      'wallpaper-custom'
    );

    if (wp.startsWith('data:') || wp.startsWith('http')) {
      desktop.style.backgroundImage = `url('${wp}')`;
      desktop.classList.add('wallpaper-custom');
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
}
