---
title: Content Model
description: How MarkStack turns files and folders into pages, URLs, sidebar entries and search results, and the rules that decide each one.
---

# Content Model

MarkStack has one rule at its core: **the structure of `content/` is the structure of your site.** This page explains exactly how that works, including the details that surprise people.

## Files become pages

Every `.md` file under `content/` becomes one page. Files that start with a dot are ignored. Nothing else in `content/` is built, so you can keep notes in `.drafts/` or `.notes.md` without publishing them.

## Folders become sections

A folder becomes a section in the sidebar. Folders can be nested to any depth.

```text
content/
├── _index.md                   Home page body
├── guides/                     Section "Guides"
│   ├── _index.md               The section's own page and its title
│   ├── installing.md
│   └── advanced/               Nested section
│       ├── _index.md
│       └── tuning.md
└── reference/
    ├── _index.md
    └── api.md
```

Each folder should have an `_index.md`. It is the landing page for the section, and its `title` is the name shown in the sidebar and breadcrumbs. The visual editor creates it for you when you create a folder.

## Titles decide URLs

The URL of a page comes from its **title**, not its file name.

| Title in frontmatter | Page URL |
| --- | --- |
| `Reset a Password` in `guides/` | `/guides/reset-a-password` |
| `Page: C++ & Q Tips!` | `/.../page-c-q-tips` |

The slug is the title in lowercase, with anything other than letters, digits, spaces and dashes removed and spaces turned into dashes. A folder's URL part comes from the title of its `_index.md`. So a section titled `Getting Started` lives at `/getting-started/` and a page `Quickstart` inside it at `/getting-started/quickstart`.

Two consequences to remember:

- **Renaming a file does not change its URL.** Changing the title does.
- **Two pages that would produce the same URL stop the build** with a message that names both, so nothing is silently overwritten:

```text
Duplicate URL /guides/setup/ is produced by both "…" and "…". Change one of the titles.
```

The same title in different folders is fine, because the folder is part of the URL.

If a page has no `title`, MarkStack uses the file name with the dashes turned into spaces and capital letters: `untitled-file.md` becomes **Untitled File**.

## The sidebar

The sidebar lists sections and pages **alphabetically by title**, with folders first and then pages. There is no ordering field. To control the order, choose titles that sort the way you want, for example `Install`, `Configure`, `Run`.

Section states are remembered in the reader's browser: which folders are open and where the list was scrolled. Folders on the way to the current page open themselves.

## What every page gets

| Element | Where it comes from |
| --- | --- |
| Breadcrumbs | The folder path, using each section's title |
| "On this page" | The page's `##` headings, shown when there are at least two |
| Reading time | Word count divided by 200 words per minute, at least one minute |
| Updated date | The `updated` or `date` frontmatter field, if present |
| Previous and next cards | The neighbouring pages in sidebar order |
| Search entries | The page itself, plus each `##`, `###` and `####` heading as its own result |
| Page description | The `description` field, used in the page's meta description and link preview tags. Without one, the site's default description is used |

## The home page

`content/_index.md` is the body of the home page. It appears below the hero block, which shows the site title and subtitle from `siteconfig.json`. See [Homepage Content](/configuration/homepage-content).

## Things the build does not check

- **Links are not validated.** A link to a page that does not exist builds fine and gives a 404 for readers. After restructuring, click through your links.
- **Links in Markdown are used as you write them.** If you publish under a sub-path with `baseUrl`, the header, sidebar and previous/next links include it automatically, but links and images you write inside your Markdown do not. Write them with the prefix. See [Media and Links](/authoring-content/media-and-links).

## Quick reference

| I want to... | Do this |
| --- | --- |
| Add a page | Create `content/<section>/<name>.md` with a title |
| Add a section | Create a folder with an `_index.md` |
| Nest sections | Put a folder with its own `_index.md` inside another |
| Hide a draft | Start the file or folder name with a dot |
| Change a page's URL | Change its `title` |
| Reorder pages | Change titles so they sort the way you want |
