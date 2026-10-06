---
title: Themes and Styling
description: Change colors, fonts, sizes, layout, the logo and code colors by editing static/css/main.css.
---

# Themes and Styling

The design is driven by CSS custom properties (variables) at the top of `static/css/main.css`. Changing a value there changes it everywhere. Nothing needs to be compiled: edit, rebuild, refresh.

## Two themes

The site has a dark theme, which is the default, and a light theme. Readers switch with the sun and moon button in the header, and the choice is saved in their browser. The variables are defined twice, in `[data-theme="dark"]` and in `[data-theme="light"]`. Edit both so the themes stay consistent.

## Colors

| Variable | Used for |
|----------|----------|
| `--color-bg-primary` | Page background |
| `--color-bg-secondary` | Header, sidebar, table headers |
| `--color-bg-tertiary`, `--color-bg-hover`, `--color-bg-active` | Raised surfaces, hover and selected rows |
| `--color-text-primary`, `-secondary`, `-tertiary` | Body, muted and faint text |
| `--color-text-link`, `--color-text-link-hover` | Links |
| `--color-border`, `--color-border-subtle` | Lines and dividers |
| `--color-accent`, `--color-accent-hover`, `--color-accent-subtle` | Highlights, active items, focus |
| `--color-code-bg`, `--color-code-border` | Code block frame |

### Change the accent color

Replace the accent and link values in each theme block. This turns the dark theme green:

```css
[data-theme="dark"] {
  --color-accent: #4cc38a;
  --color-accent-hover: #7ddcae;
  --color-accent-subtle: rgba(76, 195, 138, 0.14);
  --color-text-link: #4cc38a;
  --color-text-link-hover: #7ddcae;
}
```

Do the same in the light block with darker values, so text on white stays readable. A contrast checker helps here.

## Alert colors

Each alert type has a background, border and text variable: `--color-note-*`, `--color-tip-*`, `--color-important-*`, `--color-warning-*` and `--color-caution-*`. They are set in both themes.

## Typography

| Variable | Default |
|----------|---------|
| `--font-sans` | IBM Plex Sans, then system fonts |
| `--font-mono` | IBM Plex Mono, then common monospace fonts |
| `--font-size-xs` to `--font-size-3xl` | The size scale |

The font size variables are set twice in the file. The second block, near the end of the file, is the one that applies, so edit that one.

The IBM Plex fonts are loaded from Google Fonts by the template. To use another font, change `--font-sans` and the `<link>` in `templates/base.html`. To avoid contacting Google, remove the link and host the font files yourself with `@font-face`.

## Layout

| Variable | Default | Controls |
|----------|---------|----------|
| `--sidebar-width` | `300px` | Width of the left navigation |
| `--header-height` | `48px` | Height of the top bar |
| `--content-max-width` | `900px` | Width of the reading column |
| `--rail-width` | `200px` | Width of the "On this page" list |
| `--measure` | `110ch` | Longest line of text |
| `--border-radius` | `6px` | Corner radius |

Spacing uses `--space-xs` to `--space-2xl`.

## Logo and icon

The logo in the header and the browser tab icon are both `static/svg/logo.svg`. Replace the file with your own SVG, keeping the file name. It is shown at 32 by 32 pixels. Header links have their own icons, see [Header Links](/editing-and-admin/header-links/).

## Code highlighting

Colors for highlighted code are in `static/css/hljs-theme.css`, as plain color values for each theme, not variables. Search for the token class you want to change, such as `.hljs-keyword` or `.hljs-string`, and edit the color in the dark and light rule.

## Scrollbars

Scrollbars are thin and match the theme. Their colors are `--scrollbar-thumb` and `--scrollbar-thumb-hover`, set next to each theme's `color-scheme` near the end of the file.

## Test your change

1. Run `npm run watch` and `npm run serve`.
2. Check both themes on a page with a table, a code block and each alert type.
3. Check a narrow window. Below 1024px the layout switches for tablets and phones.
4. Open a page in the editor to see the preview with the same styles.

## Keep upgrades easy

Edit values, avoid rewriting rules, and keep your changes in Git. When you update MarkStack, a diff of `static/css/main.css` shows exactly what you changed.
