---
title: Project Structure
description: A tour of every folder and file in a MarkStack project, what each one does and which ones you should edit.
---

# Project Structure

A MarkStack project is small and every file has one job. This page lists them all so you know where to look and what is safe to change.

## The overview

```text
my-docs/
├── content/             Your pages. This is where you write.
├── static/              Styles, scripts, images and icons copied into the site
├── templates/           The HTML page template
├── template/            Starter files you can copy into content/
├── siteconfig.json      Site title, address and options
├── build.js             The site generator
├── editor-server.js     The visual editor server (optional)
├── editor.html          The editor page
├── login.html           Editor sign-in page
├── admin-users.html     Editor user management page
├── admin-links.html     Editor header links page
├── lib/                 Code used by the editor and the build
├── scripts/             Command line tools for editor administrators
├── test/                Automated tests
├── package.json         Scripts and dependencies
├── dist/                The built site (generated, never edit)
├── node_modules/        Installed libraries (generated)
└── .markstack/          Editor accounts and header links (generated, private)
```

## Folders you work in

### `content/`

Every Markdown file here becomes a page. Folders become sidebar sections. A file named `_index.md` is the page for its folder; at the top level it is the body of the home page. Files and folders whose names start with a dot are ignored.

```text
content/
├── _index.md                 Home page body
├── getting-started/
│   ├── _index.md             The "Getting Started" section page
│   ├── installation.md
│   └── quickstart.md
└── guides/
    ├── _index.md
    └── setup/                Folders can be nested to any depth
        ├── _index.md
        └── linux.md
```

Page titles, not file names, decide the URLs. See [Content Model](/authoring-content/content-model).

### `static/`

Everything here is copied into `dist/` unchanged on every build:

| Path | Contents |
| --- | --- |
| `static/css/main.css` | The whole site design, light and dark |
| `static/css/hljs-theme.css` | Code highlighting colors |
| `static/js/app.js` | Search, theme toggle, sidebar, copy buttons, diagrams |
| `static/js/search-core.js` | The search matching and ranking |
| `static/svg/logo.svg` | The logo in the header |
| `static/images/` | Favicon, and the place to put your own images |

Put your own images in `static/images/` and reference them as `/images/name.png`.

### `templates/`

`base.html` is the single page template. It holds the header, sidebar, content area and scripts, with placeholders such as `{{content}}` that the build fills in. See [Templates](/customization/templates).

### `template/`

A separate folder with an example section (`category-name/`) you can copy into `content/` as a starting point. It is never built into the site.

## Files in the project root

| File | Purpose |
| --- | --- |
| `siteconfig.json` | Site title, subtitle, public address, base path and options. See [Site Configuration](/configuration/site-config). |
| `build.js` | The generator. One file that reads `content/`, applies the template and writes `dist/`. |
| `package.json` | The npm scripts (`build`, `watch`, `serve`, `editor` and more) and the dependency list. |
| `editor-server.js`, `editor.html`, `login.html`, `admin-users.html`, `admin-links.html` | The visual editor, covered in [Editing and Admin](/editing-and-admin/). You can ignore them if you only use files. |
| `lib/` | Code for sign-in, sessions, passwords, section access, publishing, header links and front matter parsing. |
| `scripts/` | `create-admin.js` and `reset-admin.js`, run through npm scripts. |
| `test/` | The automated tests. `npm test` runs them. |

## Generated folders

| Folder | What it is | Edit it? |
| --- | --- | --- |
| `dist/` | The finished site. Deleted and rebuilt on every build. | Never |
| `node_modules/` | Libraries installed by `npm install`. | Never |
| `.markstack/` | Editor user accounts (`users.json`) and header links with their icons. Private, owner-only, and excluded from Git. | Only through the editor and its scripts |

> [!WARNING]
> `.markstack/` holds password hashes. Do not commit it, share it or copy it to a public place. It is already listed in `.gitignore`.

## What to commit to Git

Commit `content/`, `static/`, `templates/`, `siteconfig.json` and the code. Leave out `dist/`, `node_modules/` and `.markstack/`; the default `.gitignore` already does.

Next: [Set Up the Editor](/getting-started/set-up-the-editor).
