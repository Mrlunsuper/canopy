import { AUDIO_CONFIG_KEY, MUSIC_CONFIG_KEY, AMBIENT_CONFIG_KEY, STICKY_NOTES_KEY,
  DELETED_NOTES_KEY, FAVICON_CACHE_KEY, WALLPAPER_KEY } from './utils.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = value => record(value) && finite(value.x) && finite(value.y);
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const optional = (obj, key, check) => !(key in obj) || check(obj[key]);
const nullablePoint = value => value === null || point(value);
function note(value) {
  return record(value) && id(value.id) && typeof value.content === 'string'
    && typeof value.title === 'string' && point(value.position)
    && record(value.size) && finite(value.size.w) && value.size.w >= 200
    && finite(value.size.h) && value.size.h >= 120
    && ['yellow','pink','blue','green','orange','purple','white','red','teal','brown','lavender','coral'].includes(value.color)
    && optional(value, 'z', finite) && optional(value, 'pinned', v => typeof v === 'boolean');
}
function notes(value) {
  return Array.isArray(value) && value.every(note) && new Set(value.map(n => n.id)).size === value.length;
}
function audio(value, kind) {
  if (!record(value) || !optional(value, 'position', nullablePoint)) return false;
  const music = kind === MUSIC_CONFIG_KEY ? value : value.music;
  const ambient = kind === AMBIENT_CONFIG_KEY ? value : value.ambient;
  if (music !== undefined && (!record(music) || !optional(music, 'tracks', tracks => Array.isArray(tracks)
    && tracks.every(t => record(t) && typeof t.name === 'string' && typeof t.url === 'string'
      && /^https:\/\//.test(t.url)))
    || !optional(music, 'volume', v => finite(v) && v >= 0 && v <= 100))) return false;
  if (ambient !== undefined && (!record(ambient)
    || !optional(ambient, 'sounds', sounds => Array.isArray(sounds) && sounds.every(s => record(s) && id(s.id)
      && optional(s, 'icon', v => typeof v === 'string' && /^[a-z0-9-]{1,50}$/.test(v))))
    || !optional(ambient, 'activeIds', Array.isArray)
    || !optional(ambient, 'volumes', record))) return false;
  return true;
}
function validateValue(key, value) {
  if (key === STICKY_NOTES_KEY) return notes(value);
  if (key === DELETED_NOTES_KEY) return Array.isArray(value) && value.every(v => record(v) && note(v.note) && finite(v.deletedAt));
  if (key === WALLPAPER_KEY) return typeof value === 'string';
  if (key === FAVICON_CACHE_KEY) return record(value) && record(value.entries)
    && Object.values(value.entries).every(v => typeof v === 'string')
    && Array.isArray(value.order) && value.order.every(v => typeof v === 'string');
  if ([AUDIO_CONFIG_KEY, MUSIC_CONFIG_KEY, AMBIENT_CONFIG_KEY].includes(key)) {
    return typeof value === 'string' && audio(JSON.parse(value), key);
  }
  return true;
}

// Reject the entire backup before any destructive storage operation.
export function validateBackup(raw) {
  if (!record(raw)) throw new Error('Backup must be an object');
  if (raw.app !== 'canopy') {
    if (!Array.isArray(raw.items)) throw new Error('Invalid desktop backup');
    return;
  }
  if (raw.version !== 2 || !record(raw.chromeStorage) || !record(raw.localStorage)) {
    throw new Error('Unsupported or malformed backup format');
  }
  for (const [key, value] of Object.entries(raw.chromeStorage)) {
    if (!validateValue(key, value)) throw new Error(`Invalid backup field: ${key}`);
  }
  for (const [key, text] of Object.entries(raw.localStorage)) {
    if (typeof text !== 'string') throw new Error(`Invalid local storage field: ${key}`);
    if ([STICKY_NOTES_KEY, DELETED_NOTES_KEY, FAVICON_CACHE_KEY].includes(key)) {
      if (!validateValue(key, JSON.parse(text))) throw new Error(`Invalid backup field: ${key}`);
    } else if (!validateValue(key, text)) throw new Error(`Invalid backup field: ${key}`);
    if (['pomodoro_config', 'canopy_clock_position', 'canopy_clock_size', 'canopy_weather_config',
      'canopy_weather_cache', 'canopy_today_panel_position', 'canopy_widget_visibility'].includes(key)) {
      const value = JSON.parse(text);
      if (!record(value)) throw new Error(`Invalid widget configuration: ${key}`);
      if (key === 'pomodoro_config' && !['workMinutes','shortBreakMinutes','longBreakMinutes'].every(k => finite(value[k]) && value[k] > 0)) {
        throw new Error('Invalid Pomodoro durations');
      }
      if (key === 'canopy_weather_cache') {
        const weather = value.data || value;
        if (!record(weather) || !optional(weather, 'daily', days => Array.isArray(days)
          && days.every(day => record(day) && typeof day.date === 'string'))) throw new Error('Invalid weather cache');
      }
      if (key === 'canopy_widget_visibility' && !Object.values(value).every(v => typeof v === 'boolean')) {
        throw new Error('Invalid widget visibility');
      }
      if (key === 'canopy_clock_size' && (!finite(value.scale) || value.scale < 0.4 || value.scale > 2.5)) {
        throw new Error('Invalid clock scale');
      }
      if (key === 'canopy_weather_config' && !optional(value, 'savedCities', v => Array.isArray(v)
        && v.every(city => record(city) && typeof city.name === 'string' && finite(city.latitude) && finite(city.longitude)))) {
        throw new Error('Invalid saved cities');
      }
    }
  }
}
