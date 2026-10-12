---
title: Commands Reference
description: Every MarkStack npm script and build option, with what it does and when to use it.
---

# Commands Reference

Run all commands from the MarkStack folder. They need Node.js 24 or newer.

| Command | What it does |
|---------|--------------|
| `npm run build` | Build the site into `dist/` |
| `npm run watch` | Build, then rebuild when files change |
| `npm run serve` | Serve `dist/` locally |
| `npm run clean` | Delete `dist/` |
| `npm run editor` | Start the visual editor |
| `npm run editor:create-admin -- --user NAME` | Create the first administrator |
| `npm run editor:reset-admin -- --user NAME` | Set a new password for an administrator |
| `npm test` | Run the automated tests |

## Build

```bash
npm run build
```

The build:

1. Deletes `dist/` and copies `static/` into it.
2. Works out every page URL from the titles. If two pages produce the same URL it stops and names both.
3. Renders every Markdown file with the template, including the sidebar, breadcrumbs, table of contents and previous and next links.
4. Writes the home page, `404.html` and `search-index.json`.

It prints one line per page and ends like this:

```text
✓ Generated: / (homepage)
✓ Generated: /404.html
✓ Generated: /search-index.json (42 pages)

✅ Build complete in 458ms
📁 Output: /path/to/dist
```

The page count in the last line counts search entries, which include the sections inside pages as well as the pages.

A build that finds a problem exits with a non-zero code, so CI notices. Typical problems are invalid frontmatter and duplicate URLs. See [Common Issues](/troubleshooting/common-issues/).

### Options

Options go after `--` so npm passes them on.

| Option | Meaning |
|--------|---------|
| `--content <folder>` | Read Markdown from another folder instead of `content/` |
| `--out <folder>` | Write the site to another folder instead of `dist/` |
| `--data <folder>` | Read header links and icons from another data folder |

```bash
npm run build -- --content ./docs --out ./public
```

The data folder is chosen in this order: `--data`, then `MARKSTACK_DATA_DIR`, then the folder that holds `MARKSTACK_USERS_FILE`, then `.markstack/` inside the project.

## Watch

```bash
npm run watch
```

Builds once, then rebuilds the whole site when a file changes, is added or is removed in `content/`, `static/` or `templates/`. Changes to `siteconfig.json` and header links are not watched, so restart the command after editing them.

`watch` does not serve the site. Use a second terminal for that.

## Serve

```bash
npm run serve
```

Runs the included Node.js preview server. No package download is needed. It serves `dist/` on `http://127.0.0.1:3000`, local only. Set `MARKSTACK_PREVIEW_PORT` if port 3000 is in use. This is a preview tool, not a production web server.

Any static server works if you prefer another, for example `python3 -m http.server --directory dist`.

> [!TIP]
> Run `npm run watch` in one terminal and `npm run serve` in another. Save a file and refresh the browser.

## Clean

```bash
npm run clean
```

Removes `dist/`. A build already starts by clearing it, so you rarely need this.

## Editor

```bash
npm run editor
```

Starts the editor server and prints its address, by default `http://127.0.0.1:3001`. It does not open a browser for you. Stop it with `Ctrl+C`.

| Variable | Default | Meaning |
|----------|---------|---------|
| `MARKSTACK_EDITOR_PORT` | `3001` | Port to listen on |
| `MARKSTACK_EDITOR_HOST` | `127.0.0.1` | Address to listen on |
| `MARKSTACK_EDITOR_ALLOWED_HOSTS` | empty | Extra host names to accept, comma separated |
| `MARKSTACK_EDITOR_MAX_BODY` | 2 MB | Largest request body in bytes |
| `MARKSTACK_USERS_FILE` | `.markstack/users.json` | Where accounts are stored |
| `MARKSTACK_SESSION_IDLE_MINUTES` | `480` | Sign out after this long without activity |
| `MARKSTACK_SESSION_MAX_MINUTES` | `10080` | Longest a session can last |
| `MARKSTACK_EDITOR_COOKIE_SECURE` | off | Set to `1` when served over HTTPS |
| `MARKSTACK_TRUSTED_PROXIES` | none | Proxy addresses allowed to set the client address |

More on each in [Security](/editing-and-admin/security/) and [Team Server Setup](/build-and-deploy/team-server-setup/).

## Accounts

```bash
npm run editor:create-admin -- --user admin
npm run editor:reset-admin -- --user admin
```

Both ask for the password at a hidden prompt. If you pipe the password in, they read it from standard input. See [Users and Roles](/editing-and-admin/users-and-roles/).

## Test

```bash
npm test
```

Runs the Node.js test runner over `test/`. Run it before you send a change to the project.
