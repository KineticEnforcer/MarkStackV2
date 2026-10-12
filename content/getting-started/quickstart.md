---
title: Quickstart
description: Build the site, preview it in a browser, write your first page and see it appear automatically with watch mode.
---

# Quickstart

This page takes the project you installed and turns it into a site you can open in a browser, then adds a page of your own. You need to have finished [Installation](/getting-started/installation).

## 1. Build once

```bash
npm run build
```

MarkStack reads every Markdown file under `content/`, converts it to HTML, builds the sidebar, breadcrumbs and search index, and writes the finished site to `dist/`. The folder is deleted and rebuilt on every run, so never keep your own files in it.

## 2. Preview it

```bash
npm run serve
```

This serves `dist/` with the included Node.js preview server, without downloading a helper package. It binds only to your local machine and prints `http://127.0.0.1:3000`. Open it in a browser.

You should see the home page, the sidebar on the left, the search box at the top and a light/dark toggle. Click through a few pages, press `Ctrl+K` (or `/`) to open search, and switch themes.

> [!NOTE]
> `dist/` is plain files. You can also open it with any other static server, or upload it to a static host. See [Build and Deploy](/build-and-deploy/).

## 3. Rebuild automatically while you write

Open a second terminal in the project folder and start watch mode:

```bash
npm run watch
```

Watch mode builds once, then rebuilds whenever a file in `content/`, `static/` or `templates/` is added, changed or removed. Refresh the browser to see the result. Leave `npm run serve` running in the first terminal.

## 4. Write your first page

Create a file called `content/getting-started/my-first-page.md` with this content:

````markdown
---
title: My First Page
description: A page I wrote to try MarkStack.
---

# My First Page

This is my first page. It has **bold text**, a [link to the home page](/) and a list:

- One
- Two
- Three

> [!TIP]
> Alert boxes like this one are written with a blockquote and a marker.
````

Save it. When watch mode finishes rebuilding, the page appears in the sidebar under **Getting Started**, and you can open it at `/getting-started/my-first-page`.

Three things just happened that are worth knowing:

- The **URL comes from the title**, not the file name. `title: My First Page` becomes `my-first-page`. Renaming the file changes nothing; changing the title changes the URL.
- The **sidebar position is alphabetical** by title. Folders come first, then pages.
- The page got breadcrumbs, a reading time, search entries and previous/next links without any extra work. Longer pages with two or more `##` headings also get an "On this page" list on the right.

## 5. Change and remove

Edit the page and save: the browser shows the new version after a refresh. Delete the file and the page disappears from the sidebar, the search index and `dist/` on the next rebuild.

## Next steps

- Learn the rest of the folder layout in [Project Structure](/getting-started/project-structure).
- Write with a browser instead of files: [Set Up the Editor](/getting-started/set-up-the-editor).
- See everything Markdown can do here in [Markdown Features](/authoring-content/markdown-features).
