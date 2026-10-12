---
title: Site Config
description: Every siteconfig.json setting, what it changes, and its default.
---

# Site Config

```json
{
  "siteTitle": "Acme Knowledge Base",
  "headerTitle": "Acme Docs",
  "siteSubtitle": "Guides and reference for Acme products.",
  "siteUrl": "https://docs.example.com",
  "baseUrl": "",
  "defaultDescription": "Documentation for Acme products",
  "showHero": true
}
```

All settings are optional. A missing one falls back to the default below.

## Settings

| Setting | Default | What it does |
|---------|---------|--------------|
| `siteTitle` | none | The large heading in the home page hero |
| `headerTitle` | `siteTitle`, then `Knowledge Base` | The name beside the logo, and the end of every page title: `Page | Acme Docs` |
| `siteSubtitle` | empty | The line under the hero heading |
| `siteUrl` | empty | Your site's public address. Used for the page address in link previews (`og:url`) |
| `baseUrl` | empty | A path prefix for sites in a sub-folder, such as `/docs`. No trailing slash |
| `defaultDescription` | a generic text | Description for the home page and for any page without its own `description` |
| `showHero` | `true` | Show the hero on the home page. Set `false` to hide it |
| `allowRawHtml` | `false` | Allow raw HTML inside Markdown. See below |

## Title settings

`siteTitle` and `headerTitle` are separate on purpose. A hero can say "Acme Knowledge Base" while the header and browser tab keep a short "Acme Docs".

Write plain text in `siteTitle` and `siteSubtitle`. Site text is escaped in generated HTML; characters such as `<` and `&` remain text, not markup. Admin > General writes validated overrides to private `site-settings.json`; save, then publish. Raw HTML and baseUrl remain server-file settings.

## siteUrl

Set it to the final public address, without a trailing slash. It is only used in link preview metadata, so a wrong value does not break the site, but shared links then preview with the wrong address.

## baseUrl

Use it when the site is not at the root of its domain. For `https://example.com/docs/`:

```json
{ "baseUrl": "/docs" }
```

It prefixes the links the template writes: navigation, search results, CSS and JavaScript, header link icons. It does not change links and images you write in Markdown. See [Media and Links](/authoring-content/media-and-links/).

## allowRawHtml

By default raw HTML in Markdown is not rendered. Setting `"allowRawHtml": true` lets you write HTML tags in pages. It is a server file setting, so the editor cannot change it.

> [!WARNING]
> Raw HTML can include scripts. Turn it on only when everyone who can write pages is fully trusted.

## Settings that are accepted but not shown

`copyrightText` is still read from the file, but the default template has no footer, so nothing displays it. Add `{{copyrightText}}` to your template if you want it. See [Templates](/customization/templates/).

## Sample file in the repository

The `siteconfig.json` that comes with MarkStack uses a generic title and address. Replace the values with your own before you deploy.
