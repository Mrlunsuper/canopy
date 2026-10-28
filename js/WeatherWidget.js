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

// WMO code → Lucide icon name (day variant; clear uses moon at night)
const WMO_LUCIDE = {
  0: 'sun', 1: 'sun', 2: 'cloud-sun', 3: 'cloudy',
  45: 'cloud-fog', 48: 'cloud-fog',
  51: 'cloud-drizzle', 53: 'cloud-drizzle', 55: 'cloud-drizzle',
  56: 'cloud-drizzle', 57: 'cloud-drizzle',
  61: 'cloud-rain', 63: 'cloud-rain', 65: 'cloud-rain',
  66: 'cloud-rain', 67: 'cloud-rain',
  71: 'cloud-snow', 73: 'cloud-snow', 75: 'snowflake', 77: 'cloud-snow',
  80: 'cloud-drizzle', 81: 'cloud-rain', 82: 'cloud-rain',
  85: 'cloud-snow', 86: 'cloud-snow',
  95: 'cloud-lightning', 96: 'cloud-lightning', 99: 'cloud-lightning',
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
    this._forecastEl = null;
  }

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════

  async init() {
    this._loadConfig();
    this._applyPosition();
    this._ensureForecastEl();
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

  async refresh() {
    const updated = await this._fetchWeather();
    if (updated) this._startRefreshTimer(REFRESH_INTERVAL);
    return updated;
  }

  toggleUnit() {
    this.config.unit = this.config.unit === 'C' ? 'F' : 'C';
    const unitToggle = document.getElementById('weather-unit-toggle');
    if (unitToggle) unitToggle.textContent = this.config.unit === 'C' ? '°C' : '°F';
    this._saveConfig();
    this._render();
  }

  /** @private */
  _ensureForecastEl() {
    if (this._forecastEl || !this.pill) return;
    this._forecastEl = document.createElement('div');
    this._forecastEl.id = 'weather-forecast';
    this._forecastEl.className = 'weather-forecast';
    this.pill.appendChild(this._forecastEl);
  }

  /** @private */
  _lucideFor(code, isDay = 1) {
    const c = Number(code);
    if ((c === 0 || c === 1) && Number(isDay) !== 1) return 'moon';
    if (c === 2 && Number(isDay) !== 1) return 'cloud-moon';
    return WMO_LUCIDE[c] || 'thermometer';
  }

  getSnapshot() {
    const d = this.config.lastData;
    const info = d ? this._getWeatherInfo(d.weatherCode) : { icon: '🌡️', label: 'Loading...' };
    return {
      hasData: Boolean(d),
      icon: info.icon,
      iconLucide: d ? this._lucideFor(d.weatherCode, d.isDay) : 'thermometer',
      temperature: d ? this._formatTemp(d.temperature) : '--°',
      description: info.label,
      details: d ? {
        feelsLike: this._formatTemp(d.feelsLike),
        humidity: `${d.humidity}%`,
        windSpeed: `${Math.round(d.windSpeed)} km/h`,
      } : null,
      location: this.config.cityName || '',
      updated: d ? this._formatUpdatedTime(d.updatedAt) : '',
      unit: this.config.unit,
      daily: (d?.daily || []).map(day => ({
        date: day.date,
        max: this._formatTemp(day.max),
        min: this._formatTemp(day.min),
        lucide: this._lucideFor(day.code, 1),
      })),
    };
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
        + `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7`
        + `&timezone=auto`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!this.config.cityName && data.timezone) {
        const parts = data.timezone.split('/');
        this.config.cityName = parts[parts.length - 1].replace(/_/g, ' ');
        this._saveConfig();
      }

      if (data.current) {
        const daily = [];
        const dd = data.daily || {};
        const dates = dd.time || [];
        for (let i = 0; i < dates.length; i++) {
          daily.push({
            date: dates[i],
            code: dd.weather_code?.[i],
            max: dd.temperature_2m_max?.[i],
            min: dd.temperature_2m_min?.[i],
          });
        }
        this.config.lastData = {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          feelsLike: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          isDay: data.current.is_day,
          time: data.current.time,
          updatedAt: Date.now(),
          daily,
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
      savedCities: [], // [{ name, latitude, longitude }] max 3
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
        if (!Array.isArray(this.config.savedCities)) this.config.savedCities = [];
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

  _setIcon(iconName) {
    if (!this.iconEl) return;
    this.iconEl.innerHTML = `<i data-lucide="${iconName}"></i>`;
  }

  _render() {
    const d = this.config.lastData;

    if (d) {
      this._applyWeatherMood(d);
      const info = this._getWeatherInfo(d.weatherCode);
      this._setIcon(this._lucideFor(d.weatherCode, d.isDay));
      this.tempEl.textContent = this._formatTemp(d.temperature);
      this.descEl.textContent = info.label;

      // Detail items
      this.detailsEl.innerHTML = '';
      [
        ['thermometer', 'Feels like', this._formatTemp(d.feelsLike)],
        ['droplets', 'Humidity', `${d.humidity}%`],
        ['wind', 'Wind speed', `${Math.round(d.windSpeed)} km/h`],
      ].forEach(([iconName, title, value]) => {
        const item = document.createElement('span');
        item.className = 'weather-detail';
        item.title = title;
        const glyph = document.createElement('i');
        glyph.dataset.lucide = iconName;
        item.appendChild(glyph);
        item.append(` ${value}`);
        this.detailsEl.appendChild(item);
      });

      this.locationEl.textContent = this.config.cityName || '';
      const updatedText = this._formatUpdatedTime(d.updatedAt);
      if (this.updatedEl) this.updatedEl.textContent = updatedText;
      if (this.refreshBtn) this.refreshBtn.title = updatedText ? `Refresh weather (${updatedText.toLowerCase()})` : 'Refresh weather';
      this.player.classList.remove('loading');
      this._renderForecast(d);
    } else {
      this._applyWeatherMood(null);
      this._setIcon('thermometer');
      this.tempEl.textContent = '--°';
      this.descEl.textContent = 'Loading...';
      this.detailsEl.innerHTML = '';
      this.locationEl.textContent = '';
      if (this.updatedEl) this.updatedEl.textContent = '';
      this.player.classList.add('loading');
      if (this._forecastEl) this._forecastEl.innerHTML = '';
    }

    // Re-create lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ root: this.player });
    }

    this._emitUpdate();
  }

  /** @private */
  _renderForecast(d) {
    if (!this._forecastEl) return;
    const days = (d.daily || []).slice(0, 7);
    if (days.length === 0) { this._forecastEl.innerHTML = ''; return; }
    this._forecastEl.innerHTML = '';
    days.forEach((day, i) => {
      const cell = document.createElement('div');
      cell.className = 'weather-forecast-day';
      const label = i === 0 ? 'Today' : this._weekdayLabel(day.date);
      cell.title = `${label}: ${this._formatTemp(day.max)} / ${this._formatTemp(day.min)}`;
      const dayEl = document.createElement('span');
      dayEl.className = 'weather-forecast-label';
      dayEl.textContent = label.slice(0, 3);
      const icon = document.createElement('span');
      icon.className = 'weather-forecast-icon';
      const glyph = document.createElement('i');
      glyph.dataset.lucide = this._lucideFor(day.code, 1);
      icon.appendChild(glyph);
      const temps = document.createElement('span');
      temps.className = 'weather-forecast-temps';
      temps.textContent = Number.isFinite(day.max) && Number.isFinite(day.min)
        ? `${this._formatTemp(day.max).replace(/°[CF]$/, '°')}/${this._formatTemp(day.min).replace(/°[CF]$/, '°')}`
        : '--°/--°';
      cell.append(dayEl, icon, temps);
      this._forecastEl.appendChild(cell);
    });
  }

  /** @private */
  _weekdayLabel(isoDate) {
    try {
      return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    } catch { return ''; }
  }

  _emitUpdate() {
    window.dispatchEvent(new CustomEvent('canopy:weather-update', {
      detail: this.getSnapshot(),
    }));
  }

  // ═══════════════════════════════════════════════
  //  EVENTS
  // ═══════════════════════════════════════════════

  _wireEvents() {
    // Manual refresh
    this.refreshBtn.addEventListener('click', async e => {
      e.stopPropagation();
      this.refreshBtn.classList.add('spinning');
      const updated = await this.refresh();
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
      this.toggleUnit();
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
        this.toggleUnit();
      });
    }

    if (searchBtn && cityInput) {
      const doSearch = async () => {
        const query = cityInput.value.trim();
        if (!query) return;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          let res;
          try {
            res = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(query)}&count=1&language=en`, { signal: controller.signal });
          } finally {
            clearTimeout(timeout);
          }
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const r = data.results[0];
            this.config.latitude = r.latitude;
            this.config.longitude = r.longitude;
            this.config.cityName = r.name;
            cityInput.value = r.name;
            this._rememberCity(r.name, r.latitude, r.longitude);
            this._saveConfig();
            this._renderCityList();
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

    this._renderCityList();
  }

  /** @private */
  _rememberCity(name, latitude, longitude) {
    const same = c => Math.abs(c.latitude - latitude) < 0.01 && Math.abs(c.longitude - longitude) < 0.01;
    const list = this.config.savedCities.filter(c => !same(c));
    list.unshift({ name, latitude, longitude });
    this.config.savedCities = list.slice(0, 3);
  }

  /** @private */
  _renderCityList() {
    const container = document.getElementById('weather-city-list');
    if (!container) return;
    container.innerHTML = '';
    this.config.savedCities.forEach(city => {
      const row = document.createElement('div');
      row.className = 'weather-city-row';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-btn compact weather-city-btn';
      btn.textContent = city.name;
      btn.classList.toggle('active',
        Math.abs((this.config.latitude ?? 0) - city.latitude) < 0.01 &&
        Math.abs((this.config.longitude ?? 0) - city.longitude) < 0.01);
      btn.addEventListener('click', async () => {
        this.config.latitude = city.latitude;
        this.config.longitude = city.longitude;
        this.config.cityName = city.name;
        const cityInput = document.getElementById('weather-city-input');
        if (cityInput) cityInput.value = city.name;
        this._saveConfig();
        this._renderCityList();
        await this._fetchWeather();
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'settings-btn compact weather-city-remove';
      del.title = `Remove ${city.name}`;
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.config.savedCities = this.config.savedCities.filter(c =>
          Math.abs(c.latitude - city.latitude) >= 0.01 || Math.abs(c.longitude - city.longitude) >= 0.01);
        this._saveConfig();
        this._renderCityList();
      });
      row.append(btn, del);
      container.appendChild(row);
    });
  }
}
