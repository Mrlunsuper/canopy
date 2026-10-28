// Run: node tests/widget-reliability.mjs (no dependencies).
import assert from 'node:assert/strict';
import { PomodoroTimer } from '../js/PomodoroTimer.js';
import { AudioPlayer } from '../js/AudioPlayer.js';
import { StickyNotesManager } from '../js/StickyNotesManager.js';
import { FocusMode } from '../js/FocusMode.js';
const memory = new Map();
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
const realNow = Date.now;
let now = 1000000;
Date.now = () => now;
const makeTimer = () => {
  const timer = new PomodoroTimer();
  timer._render = () => {};
  timer._playNotification = () => {};
  timer._loadConfig();
  if (!timer._restoreRunningState()) timer._setPhaseTime();
  return timer;
};
try {
  const a = makeTimer();
  a._start();
  const b = makeTimer();
  now += 90000; // suspended callback / machine sleep
  a.pause();
  assert.equal(a._remaining, 1410, 'pause recomputes from wall clock');
  b._syncStoredState();
  assert.equal(b._running, false, 'pause propagates to another tab');
  assert.equal(b._remaining, 1410);
  const reloaded = makeTimer();
  assert.equal(reloaded._remaining, 1410, 'reload keeps a paused timer');
  a._start();
  b._syncStoredState();
  now += 1500000;
  // Simulate one tab restoring first after the deadline, then the second tab waking.
  const wake = makeTimer();
  assert.equal(wake.config.completedSessions, 1);
  b._tick();
  assert.equal(b.config.completedSessions, 1, 'sequential tab wake does not count twice');
  assert.equal(b.config.phase, 'shortBreak');
  assert.equal(b._running, false);
  for (const timer of [a, b, reloaded, wake]) clearInterval(timer._interval);

  // Pending decode must not create a source after stop, and concurrent plays share one loop.
  const audio = Object.create(AudioPlayer.prototype);
  audio._ambientEpoch = 0;
  audio.config = { ambient: { playing: true, activeIds: ['rain'], volumes: {}, masterVolume: 70 } };
  audio.ambientNodes = new Map();
  audio.ambientAudios = new Map();
  audio._saveConfig = audio._render = () => {};
  audio._ambientVolumeFor = () => 0.5;
  let release, starts = 0;
  const ctx = { resume: async () => {}, destination: {}, createBufferSource: () => ({ connect() {}, start() { starts++; } }), createGain: () => ({ gain: {}, connect() {} }) };
  audio._ensureAmbientAudioContext = () => ctx;
  audio._loadAmbientBuffer = () => new Promise(resolve => { release = resolve; });
  const pending = audio._playAmbientWebAudio({ id: 'rain', url: 'rain.mp3' });
  await Promise.resolve();
  audio.stopAmbient();
  release({});
  await pending;
  assert.equal(starts, 0, 'stop during decode cannot resurrect ambient');
  audio.config.ambient.playing = true;
  await Promise.all([audio._playAmbientWebAudio({ id: 'rain' }), audio._playAmbientWebAudio({ id: 'rain' })]);
  assert.equal(starts, 1, 'overlapping plays do not create duplicate loops');

  // Flushing before debounce expiry captures the live editor text.
  const notes = new StickyNotesManager();
  notes.notes = [{ id: 'n', content: 'old' }];
  notes._saveNotes = () => {};
  document.querySelector = () => ({ querySelector: selector => selector === '.sticky-note-content' ? { textContent: 'Latest edit\nSecond line' } : { textContent: '' } });
  notes._onContentInput('n');
  notes._flushPendingSaves();
  assert.equal(notes.notes[0].content, 'Latest edit\nSecond line');
  assert.equal(notes._saveTimers.size, 0);

  // Focus must not stop a mix that the user changed manually.
  const focus = new FocusMode({ audio: { getSnapshot: () => ({ ambientSounds: [{ id: 'other', active: true }] }), stopAmbient: () => { throw Error('Must preserve user mix'); } } });
  focus.soundId = 'rain';
  focus.stopOwnedAudio();
  assert.equal(focus.soundId, null);
  console.log('PASS: pause/sleep/reload, sequential multi-tab completion, ambient decode cancellation/duplicate loops, pending note flush, Focus mix ownership');
} finally {
  Date.now = realNow;
}
