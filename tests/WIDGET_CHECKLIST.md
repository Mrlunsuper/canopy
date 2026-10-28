# Widget verification

Automated, dependency-free:

```sh
node tests/regression.mjs
node tests/widget-reliability.mjs
```

Browser smoke verification can use `python3 -m http.server 8765` and `/newtab.html`.
This does not exercise Chrome extension storage or the service worker.

## Extension acceptance checklist

Reload the unpacked extension, then:

- Today: audio list, seek and mode controls are collapsed initially. Expand with the sliders button; verify keyboard focus and sliders. Focus session is also collapsed initially.
- Open two new tabs: start/pause/reset Pomodoro from each. Other tab should follow. Reload while running and paused; time must survive.
- Sleep the machine past a timer deadline; waking should advance one phase, not replay all missed phases. Check simultaneous completion in two tabs separately: localStorage synchronization is not an atomic cross-tab completion lock.
- Close all Canopy tabs while running; no background alarm is promised. Reopening reconciles elapsed time, but cannot notify while all pages are closed.
- Ambient: select a slow-loading sound, immediately stop it. It must not start after download/decode finishes. Repeat start rapidly; no duplicate loops.
- Audio playback is tab-local, not a shared/background player. Reload intentionally does not autoplay ambient. Test autoplay restrictions and network errors with real audio URLs.
- Notes: type and immediately switch tabs/reload; verify latest text. Edit different notes in two tabs, delete one remotely, verify no resurrection. Type while another tab changes notes; focused editor should not be replaced.
- Test abrupt browser termination separately: flushing on visibility/pagehide reduces the risk but is not a guarantee that asynchronous storage completes before process termination.
- Focus: enter task, optionally choose ambient, start. Existing playing audio must not be replaced. End pauses timer and stops the session's selected ambient; a manually changed mix must be preserved. Completion restores weather display. Reload never automatically starts Focus/audio.
- At 390px width: no horizontal page overflow; panel content remains scrollable.
