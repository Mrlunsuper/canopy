# Canopy Glass

Canopy Glass is the design language for Canopy: a dark ambient desktop UI for a personal new tab workspace.

## Principles

- **Dark-first**: Canopy should feel native to a wallpaper-driven desktop. Dark gradients and custom wallpapers are the default canvas.
- **Ambient, not busy**: UI should stay calm and lightweight. Controls support the workspace instead of competing with it.
- **Desktop metaphor**: Preserve OS-like interactions: icon grid, folders, context menus, drag and drop, trash, wallpaper, and floating widgets.
- **Frosted glass surfaces**: Panels, widgets, menus, and modals use translucent dark surfaces, subtle blur, faint borders, and soft highlights.
- **Soft depth**: Use gentle shadows and light inset/raised effects. Avoid hard card shadows or flat SaaS panels.
- **Lavender accent**: Lavender is the primary identity color for focus, active, selected, and progress states.
- **Subtle motion**: Interaction should use short fades, small scale/translate changes, and soft glow. Avoid bouncy or game-like motion.

## Tokens

Use the CSS variables in `styles.css` before adding one-off colors.

- **Background**: deep navy, violet, teal, and cosmic gradients.
- **Surface**: translucent dark glass for widgets, panels, menus, and modal shells.
- **Border**: low-opacity white borders for separation; stronger borders only for active/focus states.
- **Text**: high-opacity white for primary text, muted white for secondary and metadata.
- **Accent**: lavender for primary action, selected state, focus ring, progress, and active navigation.
- **Depth**: soft dark shadows with occasional inner highlight or inset shadow.
- **Radius**: medium to large rounding, with pill shapes for floating controls.
- **Motion**: fast transitions around 150-220ms; slower panel transitions around 350ms.

## Component Rules

### Desktop Icons

- Icon tiles should be compact, glassy, and readable on wallpaper.
- Selection uses lavender tint, soft border, and restrained glow.
- Labels keep strong text shadow for wallpaper contrast.

### Floating Widgets

- Audio, Pomodoro, and Weather share the same pill glass surface.
- Controls inside widgets are compact, low-contrast by default, and brighter on hover.
- Running or loaded states should not become visually loud; prefer border clarity over heavy glow.

### Panels And Modals

- Settings is a side sheet, not a centered modal.
- Command palette, folder overlay, import modal, shortcut modal, and Wallhaven modal share dark glass depth.
- Modal headers and footers use faint separators, not heavy section blocks.

### Context Menus

- Menus should feel OS-like: compact, dark, and direct.
- Hover states are glass highlights.
- Destructive actions use danger color only when needed.

### Buttons And Inputs

- Primary buttons use lavender fill or lavender gradient.
- Secondary buttons use glass/soft raised surfaces.
- Icon buttons can be transparent at rest and glass on hover.
- Inputs use dark inset surfaces and lavender focus rings.

## Do Not

- Do not introduce a bright default theme without a deliberate theme system.
- Do not use generic SaaS dashboard cards for primary surfaces.
- Do not add heavy borders, harsh shadows, or saturated accent colors everywhere.
- Do not mix icon styles; use Lucide line icons where possible.
- Do not add new dependencies or a build step for styling.

## Implementation Notes

- Prefer shared tokens and grouped component rules in `styles.css`.
- Keep overrides minimal and close to existing component structure.
- New modules or features should reuse the existing desktop, widget, modal, button, and input language before adding new primitives.
