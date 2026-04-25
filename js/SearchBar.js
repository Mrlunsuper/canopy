/* ============================================================
   CANOPY — js/SearchBar.js
   Search bar / URL navigation
   ============================================================ */

export class SearchBar {
  constructor() {
    this.inputEl = document.getElementById('search-input');
  }

  /**
   * Handle a search query — navigate to URL or Google search.
   * @param {string} query
   */
  handleSearch(query) {
    query = query.trim();
    if (!query) return;

    if (query.match(/^https?:\/\//i) || query.match(/^[a-z0-9-]+\.[a-z]{2,}/i)) {
      // navigate to URL
      const url = query.match(/^https?:\/\//i) ? query : 'https://' + query;
      window.location.href = url;
    } else {
      // Google search
      window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    }
  }

  /**
   * Wire up the Enter-key handler.
   */
  wireEvents() {
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.handleSearch(e.target.value);
    });
  }
}
