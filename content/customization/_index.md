---
title: Customization
description: Change how a MarkStack site looks, from colors and logo to the page template.
---

# Customization

MarkStack ships with one design: a dense, readable layout with a left sidebar, a search bar, and dark and light themes. You can change it without a framework or a build pipeline for styles, because the whole design is a single stylesheet and a single HTML template.

| Page | What it covers |
|------|----------------|
| [Themes and Styling](/customization/themes-and-styling/) | Colors, fonts, sizes, layout, logo and code colors |
| [Templates](/customization/templates/) | The page template and its placeholders |

Both live in your project, so you edit them like any other file and keep them in Git.

## What you can change without touching code

- The site name and subtitle: [Site Config](/configuration/site-config/)
- Links in the top bar: [Header Links](/editing-and-admin/header-links/)

## What needs a file edit

| To change | Edit |
|-----------|------|
| Colors, fonts, widths | `static/css/main.css` |
| Code highlight colors | `static/css/hljs-theme.css` |
| Logo and browser tab icon | `static/svg/logo.svg` (used for both) |
| Page structure | `templates/base.html` |

After any of these, rebuild. Publishing from the editor also picks them up, because it builds from `static/` and `templates/` too.


> [!NOTE]
> The editor preview loads the same stylesheet, so a style change also shows there after a refresh.
