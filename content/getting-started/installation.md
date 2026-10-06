---
title: Installation
description: What MarkStack needs, how to get the code, how to install the dependencies and how to confirm the install works.
---

# Installation

MarkStack is a Node.js project. There is nothing to install globally: you get the code, run `npm install` once, and everything runs from the project folder.

## Requirements

MarkStack needs **Node.js 24 or newer**. The version is enforced in `package.json`, so an older Node prints a warning during install and may fail with syntax errors when you build.

Check what you have:

```bash
node --version
npm --version
```

If `node --version` prints `v24.0.0` or higher, you are ready. Otherwise install the current LTS release from [nodejs.org](https://nodejs.org), or use a version manager such as `nvm`, `fnm` or `volta` and select version 24.

Git is optional. You need it only to download the code with `git clone`, or to keep your site under version control.

## Get the code

Clone your copy of the repository and enter the folder:

```bash
git clone <repository-url> my-docs
cd my-docs
```

Replace `<repository-url>` with the address of the repository you were given. You can also download the source as a ZIP file from the repository page and unpack it. The folder name is up to you.

## Install the dependencies

```bash
npm install
```

This reads `package.json` and downloads the libraries MarkStack uses into `node_modules/`:

| Library | Used for |
| --- | --- |
| `markdown-it` and its plugins | Converting Markdown to HTML: heading anchors, footnotes, task lists |
| `highlight.js` | Syntax highlighting in code blocks |
| `gray-matter` and `js-yaml` | Reading the YAML block at the top of each page |
| `chokidar` | Watching files for changes in watch mode |

Use `npm ci` instead of `npm install` when you want exactly the versions in `package-lock.json`, for example in automated builds.

## Check that it works

Run a build:

```bash
npm run build
```

You should see one line per page, then a summary like this:

```text
🔨 Building MarkStack...

✓ Copied static files

✓ Header links: 0 shown (data: /path/to/my-docs/.markstack)

✓ Generated: /
✓ Generated: /getting-started/
...
✓ Generated: /404.html
✓ Generated: /search-index.json (… pages)

✅ Build complete in 525ms
📁 Output: /path/to/my-docs/dist
```

The exact page count and timing depend on your content and machine. When you see `Build complete`, the install works. The site is now in the `dist/` folder.

## What if something fails

| Symptom | Likely cause and fix |
| --- | --- |
| `SyntaxError` when building | Node.js is older than 24. Check `node --version` and upgrade. |
| `Cannot find module` | Dependencies are missing. Run `npm install` in the project folder. |
| `EACCES` errors during `npm install` | The folder is not writable by your user. Do not use `sudo`; fix the folder permissions or clone somewhere you own. |
| The build says a URL is used twice | Two pages have the same title in the same folder. Titles decide URLs, so give one of them a different title. |

More fixes are in [Troubleshooting](/troubleshooting/).

Next: [Quickstart](/getting-started/quickstart).
