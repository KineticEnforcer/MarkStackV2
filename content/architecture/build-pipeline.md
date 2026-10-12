---
title: Build Pipeline
description: What npm run build does, step by step, and how the editor's Publish Changes reuses it.
---

# Build Pipeline

`npm run build` runs `build.js`. It reads your files and writes a complete site. The order matters, because each step uses the result of the one before.

## 1. Read the settings

`siteconfig.json` is read once at start. Missing values get defaults. The `--content`, `--out` and `--data` options choose other folders. See [Commands Reference](/build-and-deploy/commands-reference/).

## 2. Start clean

The output folder is deleted and created again, then everything in `static/` is copied into it. A stale file from a previous build cannot survive.

## 3. Map the URLs

Before any page is rendered, the build walks `content/` and decides the URL of every page and section from its title. Files and folders whose names start with a dot are skipped. If two pages would get the same URL, the build stops and names both:

```text
Duplicate URL /guides/setup/ is produced by both "Setup" and "setup". Change one of the titles.
```

Doing this first means every page and the sidebar agree on addresses. See [Content Model](/authoring-content/content-model/).

## 4. Render each page

For each Markdown file:

1. The YAML frontmatter is parsed. Invalid YAML stops the build with the YAML error and its line and column inside the frontmatter. The message does not name the file, so check the page you changed last.
2. The Markdown is rendered with `markdown-it`, with anchors on headings, footnotes, task lists, and highlighted code with a copy button. Mermaid blocks are kept as text for the browser to draw.
3. The page gets a breadcrumb trail, the sidebar with its current page marked, an "On this page" list built from the `##` headings, an updated date and a reading time, and previous and next links.
4. The result is put into `templates/base.html` and written to `<url>/index.html`.
5. The page and its `##` to `####` sections are added to the search index.

## 5. Home page, 404 and search index

The home page is built from the hero in `siteconfig.json` plus `content/_index.md`. The 404 page uses the same template. The search index is written to `search-index.json`. See [Search and Indexing](/architecture/search-and-indexing/).

## 6. Header links

Header links and their icons are read from the data folder and written into the pages. The icons are copied into the output.

## Failing safely

The build exits with a non-zero code on invalid frontmatter and duplicate URLs, which stops CI and stops Publish Changes before it switches anything live.

## How Publish Changes uses it

Publish copies your content into a snapshot, runs this same `build.js` against it with `--out` set to a temporary folder, checks the result, then swaps it into place. Publishing uses the same build you would run by hand.

The live editor preview is a separate browser-side `markdown-it` renderer that loads the site stylesheet. It does not install the build's footnote, task-list or heading-anchor plugins, and image URLs resolve against the editor host. Use the built page to check the final reader result. See [Visual Editor](/editing-and-admin/visual-editor/) and [Publishing](/editing-and-admin/publishing/).

## Watch mode

`npm run watch` builds once, then reruns the whole build when a file in `content/`, `static/` or `templates/` changes. It does not rebuild only the changed page, so every change refreshes the navigation and search index correctly.
