---
title: Navigation and Routing
description: How MarkStack turns titles into URLs and builds the sidebar, breadcrumbs, table of contents and previous and next links.
---

# Navigation and Routing

All navigation is generated at build time from the folder tree. There is no menu file to maintain.

## URLs

A URL is built from titles, not file names:

1. Take the title from the frontmatter. If there is none, use the file name, capitalized.
2. Lowercase it, remove characters other than letters, digits, spaces and dashes, turn spaces into dashes, and collapse repeated dashes.
3. For a page, put it after the URL of its folder. A folder's own segment comes from the title in its `_index.md`.

| Title | Result |
|-------|--------|
| `Getting Started` | `getting-started` |
| `Page: C++ & Q Tips!` | `page-c-q-tips` |
| `Editing and Admin` | `editing-and-admin` |

So a page titled "Installation" in a folder titled "Getting Started" lives at `/getting-started/installation`. Section pages end with a slash, for example `/getting-started/`.

Because titles decide URLs, renaming a title changes the address. Update links to it. The build does not check links.

Two pages that would share a URL fail the build and the error names both.

## Output layout

Each page is written as `<url>/index.html`, so servers that serve directory indexes need no rewrite rules. See [Deployment Guide](/build-and-deploy/deployment-guide/).

## Sidebar

The sidebar shows the whole tree on every page. Within a folder, sub-folders come first, then pages, both sorted by title using JavaScript's `localeCompare`. The folders along the path to the current page are open and the current page is marked. Readers can collapse the sidebar, and the choice is remembered in their browser.

To control the order today, choose titles that sort the way you want. There is no `order` field.

## Breadcrumbs

The trail above each page is Home, then each folder, then the page, taken from the same titles and URLs.

## Table of contents

The "On this page" list on the right shows the `##` headings of the page. It only appears when there are at least two. It is hidden when the window is narrower than about 1180 pixels.

## Previous and next

The cards at the bottom follow the sidebar order, top to bottom, so reading order is the same as navigation order. A folder's own page counts as a stop before its children.

## Header

The top bar holds the logo and name, the search box, header links, and the theme switch. Header links are managed by an administrator. See [Header Links](/editing-and-admin/header-links/).

## Edge cases

- A folder without `_index.md` still appears in the sidebar, titled from its folder name, but there is no page behind its link. Give every folder an `_index.md`.
- A page without a title takes its file name as the title.
- Files and folders whose names begin with a dot never appear.
- An `_index.md` at the top of `content/` is the home page content, not a page in the sidebar.
