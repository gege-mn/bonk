# Bonk design system

Bonk's look is data. Every screen, the status pages and the admin alike, reads color, type and shape only from `--bonk-*` CSS custom properties. Those come from a **theme** object stored in D1. The site's theme is edited under **Admin → Settings → Appearance** and styles the admin and every status page that hasn't set its own; a page can override it under **Admin → Status pages → (page) → Appearance**. Change a theme and everything using it follows; no rebuild is needed.

- Tokens, presets and validation: [`src/lib/theme.ts`](../src/lib/theme.ts)
- Components (plain CSS classes): [`src/lib/styles/bonk.css`](../src/lib/styles/bonk.css)

The default theme is **Gege**: warm paper, near-black ink, one violet accent, condensed uppercase display type over a monospaced body. It's quiet when things are fine and loud when they aren't.

## Principles

1. **Healthy is quiet, trouble is loud.** "Up" is drawn in a dark neutral, not green. Only degraded (amber) and down (vermilion) call attention. A green wall teaches people to stop looking.
2. **Status is never told by hue alone.** Down and degraded must differ in lightness, and every status also has a text label: a tag, a tooltip or a legend. The contrast panel enforces a minimum ratio between them.
3. **One accent.** The accent marks what you can act on: links, the primary button, focus, selection. Never use it for status.
4. **Say the sentence.** The status page leads with one plain sentence ("Sonor API is responding slowly"), not a dashboard.
5. **Tokens only.** Components never contain a raw color, font or radius. If you need a new value, add a token.

## Tokens

### Color

Each theme has a `light` and a `dark` palette with the same keys. `mode` picks `light`, `dark`, or `system`, which follows the visitor's OS setting.

| Token | CSS variable | Used for | Rule |
| --- | --- | --- | --- |
| `bg` | `--bonk-bg` | Page background; text on the admin sidebar | |
| `surface` | `--bonk-surface` | Panels, inputs, cards | Slightly off `bg` |
| `ink` | `--bonk-ink` | Text, strong rules, the admin sidebar | ≥ 4.5:1 on `bg` and `surface` |
| `muted` | `--bonk-muted` | Captions, timestamps, labels | ≥ 4.5:1 on `bg` |
| `line` | `--bonk-line` | Hairlines, input borders | |
| `accent` | `--bonk-accent` | Links, primary buttons, focus ring | ≥ 4.5:1 on `bg` |
| `accentInk` | `--bonk-accent-ink` | Text on `accent` | ≥ 4.5:1 on `accent` |
| `up` | `--bonk-up` | Healthy bars and dots | ≥ 3:1 on `bg` |
| `degraded` | `--bonk-degraded` | Slow/flaky | Lightness differs from `down` (≥ 1.3:1) |
| `down` | `--bonk-down` | Outages | ≥ 3:1 on `bg` |
| `nodata` | `--bonk-nodata` | No data yet, paused | |

Derived automatically (you don't set these): `--bonk-on-up`, `--bonk-on-degraded` and `--bonk-on-down`. Each is whichever of `ink`/`bg` reads better on that fill; filled status tags use them for their text.

### Type

| Token | CSS variable | Role | Gege default |
| --- | --- | --- | --- |
| `fonts.display` | `--bonk-font-display` | The status headline, page titles. Rendered uppercase. | Oswald |
| `fonts.heading` | `--bonk-font-heading` | Names, section heads, buttons | Space Grotesk |
| `fonts.body` | `--bonk-font-body` | Everything else | Space Mono |

Font names must be Google Fonts families or one of `System sans`, `System serif` and `System mono`. The system ones load nothing, which suits people who'd rather not call Google.

### Shape

`radius` is `square` (0), `soft` (4/8 px) or `round` (8/16 px). It maps to `--bonk-radius-sm` for controls and tags, and `--bonk-radius-md` for panels.

## Presets

| Preset | Mode | Character |
| --- | --- | --- |
| **Gege** (default) | light, with a matching dark palette | Paper, ink, violet; Oswald / Space Grotesk / Space Mono; square |
| **Night** | dark | Violet-grey night; Bricolage Grotesque / IBM Plex Mono; soft |
| **Plain** | follows the visitor | White/near-black, blue accent, system fonts; round |

Choosing a preset copies it into the editor as a starting point. To add a preset, append it to `PRESETS` in `theme.ts` with both palettes filled in, and check it against the contrast panel.

## Components

These are plain classes in `bonk.css`. Svelte components add layout, never color.

| Class | What |
| --- | --- |
| `.t-display` + `.t-display-xl / -l / -m` | Display type (uppercase, tight) |
| `.t-heading`, `.t-eyebrow`, `.t-label`, `.t-muted`, `.t-small`, `.t-xs`, `.t-num` | Text roles |
| `.swatch.s-{up,degraded,down,none,pending,paused,maintenance}` | 10 px status square |
| `.tag.s-*` | Filled status tag (uppercase) |
| `.bars` (`.bars-s`, `.bars-l`), children `.s-*` | History / heartbeat strip; add `data-tip` for a tooltip |
| `.btn`, `.btn-primary`, `.btn-quiet`, `.btn-danger`, `.btn-sm`, `.btn-icon` | Buttons (44 px tall touch target) |
| `.field` (> `.help`, `.error`), `.input`, `.select`, `.textarea` | Form fields; set `aria-invalid="true"` for the error state |
| `.check`, `.check-box` | Checkbox rows |
| `.segmented` (+ `.segmented-sm`) | Radio groups (`label > input`) or toggle buttons (`aria-pressed` / `aria-current`) |
| `.panel`, `.panel-head`, `.panel-body` | Bordered surface |
| `.rows`, `.rule`, `.hair` | Ruled lists and dividers |
| `.notice` (`-warn`, `-bad`) | Inline messages |
| `.code` | Monospace block on ink |

Status classes (`.s-*`) set `--s` (fill) and `--on` (text on fill), so any component can use them. For example, `background: var(--s)`.

## Logo

Stored in D1 (≤ 64 KB; SVG, PNG or WebP) and served from `/brand/logo`. A status page can upload its own, served from `/<slug>/logo` (`/logo` for the default page); without one, that address serves the site's logo in the page's colors.

- SVGs that paint with `currentColor` are recolored when served: the theme's `ink` by default, `bg` with `?on=ink` (the admin sidebar), or any `?color=<hex>`. One monochrome SVG therefore works on light, dark and inverted surfaces.
- Uploads with scripts, event handlers, external references or `foreignObject` are rejected. Logos are also only ever served as images, with a `default-src 'none'` CSP.
- The default mark is the Gege squircle, a placeholder until Bonk has its own.

## Accessibility checklist

- Primary controls are at least 44 px tall (`.btn`, inputs, nav rows). The `-sm` variants (34–36 px) are for dense rows beside a larger target, never as the only control.
- Everything interactive is a real `<a>`, `<button>`, `<input>` or `<label>`, and icon-only buttons have an `aria-label`.
- The focus ring is `--bonk-accent` at 2 px, drawn on `:focus-visible`.
- `prefers-reduced-motion` turns off all transitions.
- The contrast panel under Appearance flags any pair below its minimum before you publish.
