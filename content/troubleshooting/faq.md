---
title: Frequently Asked Questions
description: Short answers about what MarkStack is, what it does well, and what it does not do.
---

# Frequently Asked Questions

## General

### What is MarkStack?

A static site generator for knowledge bases and documentation. You write Markdown files in folders. MarkStack builds them into a fast site with a sidebar, search, a table of contents, dark and light themes, and previous and next links. It also includes an optional browser editor with accounts, so people who do not use Git can contribute.

### What makes it different?

- **The folder tree is the site.** There is no navigation file to maintain.
- **Search with no service.** Typo tolerant, phrase search, and results that link straight to a heading, all running in the browser.
- **An editor included.** A live preview using the real stylesheet, accounts for administrators and editors, editors limited to the sections you give them, and a Publish Changes button that builds, checks and switches the site, keeping the previous version.
- **A small codebase.** One build script, one template, one stylesheet. You can read it, and change it.
- **Static output.** Host it anywhere, with nothing running on the server for readers.

It is not trying to cover everything. See the limits below.

### What does it cost?

MarkStack is released under the GPL-3.0 license. See the `LICENSE` file for the terms.

### What are the requirements?

Node.js 24 or newer, and a computer to build on. Readers need only a browser.

### Who is it for?

Teams that want documentation, a handbook or a knowledge base that they own, in plain files, with a calm reading experience and without running a CMS.

## Writing

### What Markdown is supported?

Headings, emphasis, lists, task lists, tables, footnotes, links, images, code with highlighting, alerts such as `[!NOTE]`, and Mermaid diagrams. See [Markdown Features](/authoring-content/markdown-features/).

### Can I use HTML in Markdown?

Not by default. An administrator of the server can turn it on with `allowRawHtml`. Only do so when all authors are trusted. See [Site Config](/configuration/site-config/).

### How do I add a page or a section?

Create a `.md` file with a `title`, or use the editor's New File and New Folder buttons. A section is a folder with an `_index.md`. See [Content Model](/authoring-content/content-model/).

### Can sections be nested?

Yes, to any depth.

### How do I control the order in the sidebar?

The sidebar is sorted by title, folders first. There is no order setting. Pick titles that sort as you want.

### How do I add images?

Put them in `static/` and link them with `/images/name.png`. See [Media and Links](/authoring-content/media-and-links/).

### Can I embed videos?

Not as embedded players, since raw HTML is off by default. Link to the video instead.

## Setup and hosting

### Where is the configuration?

In `siteconfig.json`. See [Site Config](/configuration/site-config/).

### Where can I host the site?

Anywhere that serves static files: a static hosting service, a web server such as nginx or Caddy, or object storage with a CDN. See [Deployment Guide](/build-and-deploy/deployment-guide/).

### Do I have to run the editor?

No. It is optional, and the site does not depend on it.

### Is the editor safe to expose?

It is built with sign-in, CSRF protection, rate limiting, section access and secure cookies. Even so, run it behind HTTPS and prefer keeping it off the public internet. See [Security](/editing-and-admin/security/).

### How do I run builds in CI?

See [Automated Builds](/build-and-deploy/automated-builds/).

## Customizing

### How do I change colors, fonts or the logo?

Edit `static/css/main.css` and `static/svg/logo.svg`. See [Themes and Styling](/customization/themes-and-styling/).

### Can I use a different layout?

You can edit the single template. You cannot use several templates for different pages. See [Templates](/customization/templates/).

### Is there a plugin system?

No.

## Search

### How does search work?

The build writes an index, and the browser matches against it. See [Search and Indexing](/architecture/search-and-indexing/).

### Can I exclude a page from search?

Not at the moment.

## Performance

### How fast are builds?

Building this documentation, a few dozen pages, takes roughly half a second on an ordinary computer. Every build renders every page, so time grows with page count.

### Can it handle a large site?

It suits hundreds of pages well. Beyond that the search index file and the build time grow in step with your content.

## Limits

### Multiple languages?

There is no built-in support for translations.

### Dynamic features such as comments or accounts for readers?

No. The public site is static. Use an external service if you need comments.

### A blog?

It is made for documentation. There is no feed, tags or date ordering, and the sidebar is sorted by title.

### Version history for pages?

The editor has none. Keep `content/` in Git.
