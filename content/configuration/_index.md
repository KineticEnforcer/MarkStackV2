---
title: Configuration
description: The few settings MarkStack has, in siteconfig.json, and where each one shows up on the site.
---

# Configuration

MarkStack has one configuration file, `siteconfig.json` in the project root. It holds the site's name, address and a few switches. Everything else, the pages, the navigation and the search, comes from your content.

| Page | What it covers |
|------|----------------|
| [Site Config](/configuration/site-config/) | Every setting in `siteconfig.json` |
| [Homepage Content](/configuration/homepage-content/) | The hero, and the content under it |

Settings are read when the build starts. After a change, rebuild. With `npm run watch`, restart it, because it does not watch `siteconfig.json`.

Other things are configured elsewhere:

- Header links are managed by an administrator in the editor. See [Header Links](/editing-and-admin/header-links/).
- Editor behavior comes from environment variables. See [Commands Reference](/build-and-deploy/commands-reference/).
- Colors, fonts and layout are in `static/css/main.css`. See [Themes and Styling](/customization/themes-and-styling/).
