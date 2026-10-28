# Canopy Design Language — Field Guide

## Concept

Canopy uses a **Field Guide** visual direction: a warm editorial desktop that
feels like a naturalist's field journal laid over deep botanical canvas.
Paper panels, ink text, terracotta wax-seal accent, and a serif display face
give the new-tab workspace a calm, authored character.

This direction replaces the previous bento and glass drafts. Do not append
alternate theme passes or reintroduce arcade, neon, heavy-glass, or doodle
themes.

## Tokens and Foundations

`styles.css` is the source of truth.

- **Fonts (bundled locally in `fonts/`, no CDN)**:
  - `--font-display`: Fraunces (variable, + italic) — clock, panel titles,
    modal headers, track titles, sticky notes, trash label.
  - `--font`: Karla (variable) — body, labels, buttons, forms.
  - `--font-mono`: IBM Plex Mono 500 — numerals: temps, timer, calc answers,
    track indexes, badges.
- **Ink / Paper / Terracotta**: `--ink #24281f`, `--paper #fffbf3`,
  `--terra #c2543a` (+ `--terra-strong`, `--terra-soft`). Terracotta is the
  single identity accent: primary buttons, selected states, section headings,
  form labels, mode labels, progress, folder badges.
- **Canvas wallpapers** (`--bg-*`): deep botanical radial washes, light-on-dark
  by design. The light `[data-theme]` block keeps paper panels on the canvas;
  the dark `[data-theme="dark"]` block is a tone-on-tone swap (paper→ink
  surfaces) with the same terracotta family.
- **Texture**: ink grain over the desktop (`#desktop::before`), faint paper
  fiber on shared panel surfaces (`--grain`).
- **Radius**: panels 14px (`--radius-lg`), modules/inputs 6–8px, pills only
  for badges, round icon controls, and the date chip.
- **Focus**: every interactive element exposes `--focus-ring` (terracotta) on
  `:focus-visible`.

## Component-Level Rules

Desktop icons:

- Keep the grid contract: `--icon-size: 72px`; `.desktop-icon` width stays
  `calc(var(--icon-size) + 48px)`.
- Tiles are paper cards on canvas; labels are ink chips with backdrop blur.
- Selected state uses a solid terracotta seal label; hover lifts the tile 2px.
- Hover/selected/drag-over must not change grid metrics.

Clock (hero):

- Fraunces light (~340 weight), large; the date sits in an italic Fraunces
  chip with a frosted border. No card behind the clock.

Widgets (Today panel, audio, weather, Pomodoro):

- Shared paper panel surface (`--surface-panel` + `--grain` + blur).
- Play/start actions are ink circles that turn terracotta on hover; running
  states use border clarity and small terracotta indicators, never glow.
- Times and temps use `--font-mono` with tabular numerals.

Panels, menus, and modals:

- Settings is a side sheet; command palette, folder overlay, import modal,
  Wallhaven modal, context menus, and toasts share the paper panel treatment.
- Modal headers use Fraunces titles over a faint separator — no colored
  section bands.
- Inside a panel, children are rows, controls, or unframed groups.

Buttons and inputs:

- `.btn-primary`: terracotta fill with warm shadow; `.btn-secondary`/`.settings-btn`:
  paper raised. Text controls ≥40px tall; icon controls ≥32px square.
- Inputs use `--surface-raised`, visible terracotta focus rings.
- Section headings and form labels: terracotta, uppercase, letterspaced.

Motion:

- One orchestrated load: clock/FABs settle first, then widgets and icons rise
  in with staggered `animation-delay` (`riseIn`, `settleIn`, `--ease-spring`).
- Micro-interactions: hover lifts, play-button scale, context/palette rows
  nudge 2px right. All disabled under `prefers-reduced-motion`.

## Accessibility Requirements

- Visible terracotta focus ring on every focusable control (keyboard path).
- WCAG 2.2 AA contrast against the immediate surface (ink on paper, paper on
  ink; verify custom wallpaper readability via the custom-wallpaper scrim).
- No hover-only affordance required for core workflows.
- Touch targets: ≥40px text controls, ≥32px compact icon controls.

## Content and Tone

Concise, confident labels: "Import from Bookmarks", "Drop to delete",
"Refresh weather".

## Anti-Patterns

- No second late-file override pass; no arcade/pixel/neon/heavy-glass/doodle.
- No CDN fonts or external CSS; fonts ship in `fonts/`.
- No decorative blobs or standalone gradient orbs.
- Do not shrink the icon grid without updating `GRID_COL`, `GRID_ROW`,
  drag/drop bounds, auto-arrange, and folder behavior together.
- No raw colors where semantic tokens exist (except wallpaper presets and
  sticky-note swatches).

## QA Checklist

- Reload unpacked extension; new tab opens without layout overlap.
- Fonts load from `fonts/` (check DevTools network; no external requests).
- Tab through desktop, widgets, settings, modals, command palette.
- Check icon hover/selected/drag-over/folder badge states.
- Check audio, weather, Pomodoro, Today panel, settings, context menu, folder
  modal, bookmark import, Wallhaven modal, sticky notes.
- Check narrow viewport behavior around 680px and 760px.
- Verify entry animation plays once and reduced-motion disables it.
