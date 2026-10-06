---
title: Common Issues
description: Causes and fixes for the build errors, missing pages, styling, search, deployment and editor problems people meet most.
---

# Common Issues

## Build

### The build says "Duplicate URL"

```text
Duplicate URL /guides/setup/ is produced by both "Setup" and "setup". Change one of the titles.
```

Two pages produce the same address. URLs come from titles, so "Setup" and "setup" collide, and so do "C++" and "C". Change one title.

### The build stops with a YAML error

The frontmatter is not valid YAML. The most common cause is a colon followed by a space inside a value:

```markdown
---
title: Setup: first steps
---
```

Quote the value:

```markdown
---
title: "Setup: first steps"
---
```

Other causes are tabs used for indentation, a missing closing `---`, and frontmatter written as JSON or TOML. Only YAML is accepted.

### My `siteconfig.json` changes have no effect

If the file is not valid JSON, the build prints a warning, `Could not parse siteconfig.json, using defaults`, and carries on with defaults. Look at the top of the build output. Common mistakes are a trailing comma and single quotes. Remember to rebuild, and restart `npm run watch`, which does not watch this file.

### `Cannot find module`

Dependencies are missing. Run `npm install` (or `npm ci`) in the project folder.

### Node.js version

MarkStack needs Node.js 24 or newer. Check with `node --version`.

## Pages

### A page is missing from the sidebar

- The file does not end in `.md`.
- The file or a folder above it starts with a dot. Those are ignored.
- The file is in the wrong folder. Check the tree in `content/`.
- It is `_index.md`. That file is the page of its folder, not an item inside it.

### A page has the wrong title

The title is the `title` in the frontmatter. Without it, MarkStack uses the file name with a capital letter, for example "Nofm" for `nofm.md`. Add a title.

### A page has an unexpected URL

URLs come from the title, not the file name. Special characters are removed and spaces become dashes, so `Page: C++ & Q Tips!` becomes `page-c-q-tips`. See [Content Model](/authoring-content/content-model/).

### A link to a page returns 404

The build does not check links, so a link can point to an address that no longer exists after a title changed. Open the page in the site, copy its address and use that. A folder without an `_index.md` also has no page at its address.

### An image does not show

- The file is not in `static/`. Images are served from there. See [Media and Links](/authoring-content/media-and-links/).
- The path is wrong. A file at `static/images/a.png` is `/images/a.png`.
- The site is in a sub-folder. Include the `baseUrl` prefix in image paths you write in Markdown.
- You are looking at the editor preview, which shows the image reference but not the image. Check the published page.

## Appearance

### Styles do not load

If the page is plain text, the CSS is not found. Check that `dist/css/main.css` exists, and that `baseUrl` is empty for a site at the root. If a site in a sub-folder has the wrong `baseUrl`, the CSS address is wrong.

### Readers see old styles after an update

A cached file. Hard refresh the page, or raise the `?v=` number on the stylesheet link in `templates/base.html`, and purge your CDN.

### Diagrams show as text

Mermaid is loaded from a CDN. If the reader's browser or network blocks that request, the diagram stays as its source. See [Security](/editing-and-admin/security/).

### The font looks different from the screenshots

The fonts come from Google Fonts. If they are blocked, the browser uses a system font.

### Code is not highlighted

Check that the code fence names a language that highlight.js knows, such as `javascript`, `bash` or `json`. A fence with no language is shown as plain code.

## Search

### Search finds nothing

- The site was not rebuilt after you added the page.
- You are searching for code. Code blocks are not indexed.
- `search-index.json` is missing from the output or not served. Open it in the browser.

### Ctrl+K does nothing

Click on the page first so it has focus, and check that scripts are not blocked. You can also press `/` or click the search box.

## Deployment

### It works locally but not on the server

- The server does not serve `index.html` for folder addresses. Add the setting for it. See [Deployment Guide](/build-and-deploy/deployment-guide/).
- `siteUrl` or `baseUrl` is wrong for the live address.
- Links in your Markdown start with a prefix that only exists locally.

### A deploy keeps the old content

Upload or build again, then clear the host's cache. If you use the editor, remember that Publish Changes updates only the folder on the editor's server.

## The editor

### I cannot sign in

- After five failed attempts sign-in is blocked for 15 minutes.
- Lost the administrator password? Run `npm run editor:reset-admin -- --user NAME` on the server. See [Users and Roles](/editing-and-admin/users-and-roles/).
- Behind a reverse proxy, "Host not allowed" means the public host name is missing from `MARKSTACK_EDITOR_ALLOWED_HOSTS`.

### Everyone was signed out

The editor was restarted. Sessions live in memory.

### An editor cannot see a folder

Editors only see their assigned sections. An administrator assigns them on the users page. Section folder names must be lowercase letters, digits, dashes or underscores.

### Publish stops at the first stage

The editor cannot write next to `dist/`. Give its user write access to that folder, and add it to `ReadWritePaths` if you use systemd hardening. See [Team Server Setup](/build-and-deploy/team-server-setup/).

### Publish worked but the site is the same

The public site is served from somewhere else than the editor's `dist/`. See [Deployment Guide](/build-and-deploy/deployment-guide/).

## Watch mode

### Watch does not notice my change

It watches `content/`, `static/` and `templates/`. It does not watch `siteconfig.json` or the header links, so restart it after changing them.
