/* ============================================================
   CANOPY — js/WeatherWidget.js
   Weather widget — current conditions via Open-Meteo API (free, no key)
   ============================================================ */

import { toast } from './utils.js';

const WEATHER_CONFIG_KEY = 'canopy_weather_config';
const WEATHER_CACHE_KEY  = 'canopy_weather_cache';
const REFRESH_INTERVAL   = 15 * 60 * 1000; // 15 minutes
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
    this.collapseBtn  = document.getElementById('weather-collapse');
    this.refreshBtn   = document.getElementById('weather-refresh');

    this.config = this._defaults();
    this._dragState = null;
    this._refreshTimer = null;
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
    this._loadCache();

    // Then fetch fresh data
    await this._fetchWeather();

    // Set up auto-refresh
    this._refreshTimer = setInterval(() => this._fetchWeather(), REFRESH_INTERVAL);
  }

  // ═══════════════════════════════════════════════
  //  WEATHER DATA
  // ═══════════════════════════════════════════════

  async _fetchWeather() {
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

      // Reverse geocode for city name if not set
      if (!this.config.cityName) {
        await this._reverseGeocode(lat, lon);
      }

      const url = `${FORECAST_API}?latitude=${lat}&longitude=${lon}`
        + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day`
        + `&timezone=auto`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.current) {
        this.config.lastData = {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          feelsLike: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          isDay: data.current.is_day,
          time: data.current.time,
        };
        this._saveCache(this.config.lastData);
        this._render();
      }
    } catch (err) {
      console.warn('Weather fetch failed:', err);
      // Still show cached data if available
    }
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

  async _reverseGeocode(lat, lon) {
    try {
      // Use Open-Meteo's geocoding API to find nearest city
      const url = `${GEOCODING_API}?latitude=${lat}&longitude=${lon}&count=1`;
      const res = await fetch(url);
      // The geocoding API doesn't support reverse geocoding directly,
      // so we'll use the timezone for a rough location name
      // Instead, we'll parse the timezone from the forecast response
      const forecastUrl = `${FORECAST_API}?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`;
      const forecastRes = await fetch(forecastUrl);
      if (forecastRes.ok) {
        const data = await forecastRes.json();
        if (data.timezone) {
          // Extract city from timezone (e.g. "Asia/Bangkok" → "Bangkok")
          const parts = data.timezone.split('/');
          this.config.cityName = parts[parts.length - 1].replace(/_/g, ' ');
          this._saveConfig();
        }
      }
    } catch {
      // Silently fail — not critical
    }
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
      collapsed: false,
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
        this.config.lastData = JSON.parse(raw);
        this._render();
      }
    } catch {}
  }

  _saveCache(data) {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
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

  _render() {
    const d = this.config.lastData;

    if (d) {
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
      this.player.classList.remove('loading');
    } else {
      this.iconEl.textContent = '🌡️';
      this.tempEl.textContent = '--°';
      this.descEl.textContent = 'Loading...';
      this.detailsEl.innerHTML = '';
      this.locationEl.textContent = '';
      this.player.classList.add('loading');
    }

    // Collapsed state
    this.player.classList.toggle('collapsed', this.config.collapsed);
    this.collapseBtn.innerHTML = this.config.collapsed
      ? '<i data-lucide="chevron-up"></i>'
      : '<i data-lucide="chevron-down"></i>';
    this.collapseBtn.title = this.config.collapsed ? 'Expand' : 'Collapse';

    // Re-create lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [this.detailsEl, this.collapseBtn, this.refreshBtn] });
    }
  }

  // ═══════════════════════════════════════════════
  //  EVENTS
  // ═══════════════════════════════════════════════

  _wireEvents() {
    // Collapse toggle
    this.collapseBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.config.collapsed = !this.config.collapsed;
      this._saveConfig();
      this._render();
    });

    // Manual refresh
    this.refreshBtn.addEventListener('click', async e => {
      e.stopPropagation();
      this.refreshBtn.classList.add('spinning');
      await this._fetchWeather();
      setTimeout(() => this.refreshBtn.classList.remove('spinning'), 600);
      toast('Weather updated', 'success');
    });

    // Drag to reposition
    this.pill.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      const rect = this.player.getBoundingClientRect();
      this._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false
      };
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!this._dragState) return;
      const dx = Math.abs(e.clientX - this._dragState.startX);
      const dy = Math.abs(e.clientY - this._dragState.startY);
      if (dx > 3 || dy > 3) this._dragState.moved = true;
      if (!this._dragState.moved) return;
      this.player.style.left = (e.clientX - this._dragState.offsetX) + 'px';
      this.player.style.top = (e.clientY - this._dragState.offsetY) + 'px';
      this.player.style.right = 'auto';
      this.player.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!this._dragState) return;
      if (this._dragState.moved) {
        this.config.position = {
          x: parseInt(this.player.style.left, 10),
          y: parseInt(this.player.style.top, 10)
        };
        this._saveConfig();
      }
      this._dragState = null;
    });

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
