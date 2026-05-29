# Canopy Design Language

## Context and Goals

Canopy uses a Bento visual direction: a calm desktop launcher made of modular surfaces, clear hierarchy, soft spacing, and accessible controls.

This direction replaces the previous unreleased visual language. Do not append alternate theme passes or keep legacy arcade, glass, or doodle guidance as an active design source.

## Design Tokens and Foundations

Use `styles.css` as the source of truth.

- Typography: `--font` uses Inter-compatible system UI fallbacks; `--font-mono` uses JetBrains Mono-compatible fallbacks.
- Core tokens: `--primary #FAD4C0`, `--secondary #80A1C1`, `--success #16A34A`, `--warning #D97706`, `--danger #DC2626`, `--surface #FFF5E6`, `--text #111827`.
- Surfaces: panels and modules use warm surface tokens with subtle contrast and 1px borders.
- Radius: cards and repeated blocks stay at 8px; pills are reserved for badges, sliders, and round icon controls.
- Spacing: use the 4/8/12/16/24/32 scale.
- Focus: every interactive element must expose `--focus-ring` on `:focus-visible`.

## Component-Level Rules

Desktop icons:

- Must preserve the grid contract: `--icon-size: 72px`; `.desktop-icon` width stays `calc(var(--icon-size) + 48px)`.
- Icon tiles use bento surfaces with clear selected, hover, drag-over, and focus-visible states.
- Labels must truncate on one line and keep enough contrast on wallpaper backgrounds.
- Drag-over and selected states may change border, background, and shadow, but must not change grid metrics.

Widgets:

- Clock, Today, weather, audio, and Pomodoro use compact bento blocks with shared border, shadow, and spacing tokens.
- Primary play/start actions use `--primary-strong`; secondary controls use neutral surface states.
- Active/running states use border color and a small accent indicator, not glow.

Panels, menus, and modals:

- Settings, folder overlay, command palette, context menus, toasts, and modals share the same panel, row, and control treatments.
- Headers use a subtle `--secondary-soft` band and clear title hierarchy.
- Do not create nested card stacks. Inside a panel, children should be rows, controls, or unframed content groups.

Buttons and inputs:

- Text buttons must be at least 40px tall; prefer 44px when space allows.
- Icon-only controls must keep a minimum 32px square hit target.
- Inputs use `--surface-raised`, `--border`, and visible focus rings.
- Disabled states must reduce opacity without making labels unreadable.

Responsive behavior:

- Long labels must truncate inside icon labels, track rows, widgets, and settings rows.
- Settings navigation becomes horizontally scannable on small screens.
- Fixed-format UI such as icon tiles, widgets, and modal grids must keep stable dimensions.

## Accessibility Requirements and Testable Acceptance Criteria

- Every button, input, textarea, and focusable desktop item shows a visible focus ring when reached by keyboard.
- Text contrast must meet WCAG 2.2 AA against its immediate surface.
- No hover-only affordance may be required to complete a core workflow.
- `prefers-reduced-motion: reduce` disables nonessential animations and transitions.
- Touch targets for text controls are at least 40px high; compact icon controls are at least 32px square.

## Content and Tone Standards

Use concise, confident labels.

- Use “Import from Bookmarks”, not “Bring over browser places”.
- Use “Drop to delete”, not “Release here to make this disappear”.
- Use “Refresh weather”, not “Ask again”.

Keep expression in layout and color, not in critical UI copy.

## Anti-Patterns and Prohibited Implementations

- Do not append a second late-file override pass.
- Do not reintroduce arcade, pixel, neon, heavy glass, or doodle themes.
- Do not import CDN fonts or external CSS.
- Do not use decorative blobs or gradient orbs as standalone background elements.
- Do not shrink the desktop icon grid without updating `GRID_COL`, `GRID_ROW`, drag/drop bounds, auto-arrange, and folder behavior together.
- Do not use raw colors where a semantic Bento token exists, except for fixed wallpaper presets and sticky note swatches.

## QA Checklist

- Reload the unpacked extension and verify the new tab opens without layout overlap.
- Tab through desktop, widgets, settings, modals, and command palette; every focused control must be visible.
- Check icon hover, selected, drag-over, and folder badge states.
- Check audio, weather, Pomodoro, Today panel, settings, context menu, folder modal, bookmark import modal, Wallhaven modal, and sticky notes.
- Check narrow viewport behavior around 680px and 760px.
- Search `styles.css` for old theme names before release; there should be no active late override theme.
