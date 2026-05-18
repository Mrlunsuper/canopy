/* ============================================================
   CANOPY — js/WeatherWidget.js
   Weather widget — current conditions via Open-Meteo API (free, no key)
   ============================================================ */

import { toast } from './utils.js';

const WEATHER_CONFIG_KEY = 'canopy_weather_config';
const WEATHER_CACHE_KEY  = 'canopy_weather_cache';
const REFRESH_INTERVAL   = 15 * 60 * 1000; // 15 minutes
const CACHE_TTL          = REFRESH_INTERVAL;
const GEOCODING_API      = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API       = 'https://api.open-meteo.com/v1/forecast';

// WMO Weather interpretation codes → icon + label
const WMO_CODES = {
  0:  { icon: '☀️', label: 'Clear sky' },
  1:  { icon: '🌤️', label: 'Mainly clear' },
  2:  { icon: '⛅', label: 'Partly cloudy' },
  3:  { icon: '☁️', label: 'Overcast' },
  45: { icon: '🌫️', label: 'Fog' },
  48: { icon: '🌫️', label: 'Rime fog' },
  51: { icon: '🌦️', label: 'Light drizzle' },
  53: { icon: '🌦️', label: 'Drizzle' },
  55: { icon: '🌧️', label: 'Dense drizzle' },
  56: { icon: '🌧️', label: 'Freezing drizzle' },
  57: { icon: '🌧️', label: 'Heavy freezing drizzle' },
  61: { icon: '🌧️', label: 'Slight rain' },
  63: { icon: '🌧️', label: 'Rain' },
  65: { icon: '🌧️', label: 'Heavy rain' },
  66: { icon: '🌧️', label: 'Freezing rain' },
  67: { icon: '🌧️', label: 'Heavy freezing rain' },
  71: { icon: '🌨️', label: 'Slight snow' },
  73: { icon: '🌨️', label: 'Snow' },
  75: { icon: '❄️', label: 'Heavy snow' },
  77: { icon: '🌨️', label: 'Snow grains' },
  80: { icon: '🌦️', label: 'Slight showers' },
  81: { icon: '🌧️', label: 'Showers' },
  82: { icon: '🌧️', label: 'Violent showers' },
  85: { icon: '🌨️', label: 'Snow showers' },
  86: { icon: '🌨️', label: 'Heavy snow showers' },
  95: { icon: '⛈️', label: 'Thunderstorm' },
  96: { icon: '⛈️', label: 'Thunderstorm + hail' },
  99: { icon: '⛈️', label: 'Thunderstorm + heavy hail' },
};

export class WeatherWidget {
  constructor() {
    this.player       = document.getElementById('weather-widget');
    this.pill         = document.getElementById('weather-pill');
    this.iconEl       = document.getElementById('weather-icon');
    this.tempEl       = document.getElementById('weather-temp');
    this.descEl       = document.getElementById('weather-desc');
    this.detailsEl    = document.getElementById('weather-details');
    this.locationEl   = document.getElementById('weather-location');
    this.updatedEl    = document.getElementById('weather-updated');
    this.refreshBtn   = document.getElementById('weather-refresh');

    this.config = this._defaults();
    this._dragState = null;
    this._refreshTimer = null;
    this._refreshTimeout = null;
    this._fetchPromise = null;
  }

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════

  async init() {
    this._loadConfig();
    this._applyPosition();
    this._render();
    this._wireEvents();
    this._wireSettings();

    // Try to load cached data first for instant display
    const cacheAge = this._loadCache();

    // Then fetch fresh data only when the cache is stale or missing
    const shouldFetch = !this.config.lastData || cacheAge >= CACHE_TTL;
    if (shouldFetch) {
      await this._fetchWeather();
    }

    // Set up auto-refresh from the actual cache expiry point
    this._startRefreshTimer(shouldFetch ? REFRESH_INTERVAL : CACHE_TTL - cacheAge);
  }

  // ═══════════════════════════════════════════════
  //  WEATHER DATA
  // ═══════════════════════════════════════════════

  async _fetchWeather() {
    if (this._fetchPromise) return this._fetchPromise;

    this._fetchPromise = this._doFetchWeather();
    try {
      return await this._fetchPromise;
    } finally {
      this._fetchPromise = null;
    }
  }

  async _doFetchWeather() {
    try {
      let lat = this.config.latitude;
      let lon = this.config.longitude;

      // If no coordinates saved, try geolocation
      if (lat === null || lon === null) {
        const pos = await this._getGeolocation();
        if (pos) {
          lat = pos.latitude;
          lon = pos.longitude;
          this.config.latitude = lat;
          this.config.longitude = lon;
          this._saveConfig();
        } else {
          // Fall back to a default (London)
          lat = 51.5074;
          lon = -0.1278;
        }
      }

      const url = `${FORECAST_API}?latitude=${lat}&longitude=${lon}`
        + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day`
        + `&timezone=auto`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!this.config.cityName && data.timezone) {
        const parts = data.timezone.split('/');
        this.config.cityName = parts[parts.length - 1].replace(/_/g, ' ');
        this._saveConfig();
      }

      if (data.current) {
        this.config.lastData = {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          feelsLike: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          isDay: data.current.is_day,
          time: data.current.time,
          updatedAt: Date.now(),
        };
        this._saveCache(this.config.lastData);
        this._render();
        return true;
      }
    } catch (err) {
      console.warn('Weather fetch failed:', err);
      // Still show cached data if available
    }

    return false;
  }

  _startRefreshTimer(initialDelay = REFRESH_INTERVAL) {
    if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
    if (this._refreshTimer) clearInterval(this._refreshTimer);

    this._refreshTimeout = setTimeout(async () => {
      this._refreshTimeout = null;
      await this._fetchWeather();
      this._refreshTimer = setInterval(() => this._fetchWeather(), REFRESH_INTERVAL);
    }, Math.max(1000, initialDelay));
  }

  _getGeolocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 600000 }
      );
    });
  }

  // ═══════════════════════════════════════════════
  //  PERSISTENCE
  // ═══════════════════════════════════════════════

  _defaults() {
    return {
      latitude: null,
      longitude: null,
      cityName: '',
      position: null,
      lastData: null,
      unit: 'C',  // 'C' or 'F'
    };
  }

  _loadConfig() {
    try {
      const raw = localStorage.getItem(WEATHER_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.config = { ...this._defaults(), ...parsed };
        // Don't persist lastData in config
        this.config.lastData = null;
      }
    } catch {}
  }

  _saveConfig() {
    try {
      const { lastData, ...rest } = this.config;
      localStorage.setItem(WEATHER_CONFIG_KEY, JSON.stringify(rest));
    } catch {}
  }

  _loadCache() {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        this.config.lastData = cached.data || cached;
        if (cached.savedAt && !this.config.lastData.updatedAt) {
          this.config.lastData.updatedAt = cached.savedAt;
        }
        this._render();
        return Date.now() - (cached.savedAt || this.config.lastData.updatedAt || 0);
      }
    } catch {}
    return Infinity;
  }

  _saveCache(data) {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  _applyPosition() {
    if (this.config.position) {
      this.player.style.left = this.config.position.x + 'px';
      this.player.style.top = this.config.position.y + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    }
  }

  // ═══════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════

  _getWeatherInfo(code) {
    return WMO_CODES[code] || { icon: '🌡️', label: 'Unknown' };
  }

  _formatTemp(celsius) {
    if (this.config.unit === 'F') {
      return `${Math.round(celsius * 9 / 5 + 32)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  }

  _formatUpdatedTime(timestamp) {
    if (!timestamp) return '';
    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (diffMinutes < 1) return 'Updated now';
    if (diffMinutes === 1) return 'Updated 1 min ago';
    if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`;
    const hours = Math.round(diffMinutes / 60);
    return hours === 1 ? 'Updated 1 hr ago' : `Updated ${hours} hr ago`;
  }

  _applyWeatherMood(data) {
    this.player.classList.remove(
      'weather-day',
      'weather-night',
      'weather-clear',
      'weather-cloud',
      'weather-rain',
      'weather-storm',
      'weather-snow',
      'weather-fog'
    );

    if (!data) return;

    const code = Number(data.weatherCode);
    const timeClass = Number(data.isDay) === 1 ? 'weather-day' : 'weather-night';
    let moodClass = 'weather-cloud';

    if (code === 0 || code === 1) moodClass = 'weather-clear';
    else if (code === 45 || code === 48) moodClass = 'weather-fog';
    else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) moodClass = 'weather-rain';
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) moodClass = 'weather-snow';
    else if (code >= 95) moodClass = 'weather-storm';

    this.player.classList.add(timeClass, moodClass);
  }

  _render() {
    const d = this.config.lastData;

    if (d) {
      this._applyWeatherMood(d);
      const info = this._getWeatherInfo(d.weatherCode);
      this.iconEl.textContent = info.icon;
      this.tempEl.textContent = this._formatTemp(d.temperature);
      this.descEl.textContent = info.label;

      // Detail items
      this.detailsEl.innerHTML = `
        <span class="weather-detail" title="Feels like">
          <i data-lucide="thermometer"></i>
          ${this._formatTemp(d.feelsLike)}
        </span>
        <span class="weather-detail" title="Humidity">
          <i data-lucide="droplets"></i>
          ${d.humidity}%
        </span>
        <span class="weather-detail" title="Wind speed">
          <i data-lucide="wind"></i>
          ${Math.round(d.windSpeed)} km/h
        </span>
      `;

      this.locationEl.textContent = this.config.cityName || '';
      if (this.updatedEl) this.updatedEl.textContent = this._formatUpdatedTime(d.updatedAt);
      this.player.classList.remove('loading');
    } else {
      this._applyWeatherMood(null);
      this.iconEl.textContent = '🌡️';
      this.tempEl.textContent = '--°';
      this.descEl.textContent = 'Loading...';
      this.detailsEl.innerHTML = '';
      this.locationEl.textContent = '';
      if (this.updatedEl) this.updatedEl.textContent = '';
      this.player.classList.add('loading');
    }

    // Re-create lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [this.detailsEl, this.refreshBtn] });
    }
  }

  // ═══════════════════════════════════════════════
  //  EVENTS
  // ═══════════════════════════════════════════════

  _wireEvents() {
    // Manual refresh
    this.refreshBtn.addEventListener('click', async e => {
      e.stopPropagation();
      this.refreshBtn.classList.add('spinning');
      const updated = await this._fetchWeather();
      if (updated) this._startRefreshTimer(REFRESH_INTERVAL);
      setTimeout(() => this.refreshBtn.classList.remove('spinning'), 600);
      toast(updated ? 'Weather updated' : 'Weather update failed', updated ? 'success' : 'error');
    });

    // Drag to reposition
    this.pill.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button')) return;
      const rect = this.player.getBoundingClientRect();
      this._dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false
      };
      this.pill.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    document.addEventListener('pointermove', e => {
      if (!this._dragState) return;
      if (e.pointerId !== this._dragState.pointerId) return;
      const dx = Math.abs(e.clientX - this._dragState.startX);
      const dy = Math.abs(e.clientY - this._dragState.startY);
      if (dx > 3 || dy > 3) this._dragState.moved = true;
      if (!this._dragState.moved) return;
      this.player.style.left = (e.clientX - this._dragState.offsetX) + 'px';
      this.player.style.top = (e.clientY - this._dragState.offsetY) + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    });

    const endDrag = e => {
      if (!this._dragState) return;
      if (e.pointerId !== this._dragState.pointerId) return;
      if (this._dragState.moved) {
        this.config.position = {
          x: parseInt(this.player.style.left, 10),
          y: parseInt(this.player.style.top, 10)
        };
        this._saveConfig();
      }
      try { this.pill.releasePointerCapture?.(this._dragState.pointerId); } catch {}
      this._dragState = null;
    };
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    // Toggle temperature unit on click
    this.tempEl.addEventListener('click', e => {
      e.stopPropagation();
      this.config.unit = this.config.unit === 'C' ? 'F' : 'C';
      this._saveConfig();
      this._render();
    });
  }

  _wireSettings() {
    const cityInput = document.getElementById('weather-city-input');
    const searchBtn = document.getElementById('weather-city-search');
    const unitToggle = document.getElementById('weather-unit-toggle');

    if (cityInput && this.config.cityName) {
      cityInput.value = this.config.cityName;
    }

    if (unitToggle) {
      unitToggle.textContent = this.config.unit === 'C' ? '°C' : '°F';
      unitToggle.addEventListener('click', () => {
        this.config.unit = this.config.unit === 'C' ? 'F' : 'C';
        unitToggle.textContent = this.config.unit === 'C' ? '°C' : '°F';
        this._saveConfig();
        this._render();
      });
    }

    if (searchBtn && cityInput) {
      const doSearch = async () => {
        const query = cityInput.value.trim();
        if (!query) return;
        try {
          const res = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(query)}&count=1&language=en`);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const r = data.results[0];
            this.config.latitude = r.latitude;
            this.config.longitude = r.longitude;
            this.config.cityName = r.name;
            cityInput.value = r.name;
            this._saveConfig();
            await this._fetchWeather();
            toast(`Weather set to ${r.name}`, 'success');
          } else {
            toast('City not found', 'error');
          }
        } catch {
          toast('Search failed', 'error');
        }
      };

      searchBtn.addEventListener('click', doSearch);
      cityInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSearch();
      });
    }
  }
}
