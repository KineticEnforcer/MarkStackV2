---
title: Media and Links
description: Add images, link between pages, and link to other sites in MarkStack.
---

# Media and Links

## Images

Images are plain files. Put them in the `static/` folder and refer to them with a path that starts with `/`.

```text
static/
  images/
    diagram.png
```

```markdown
![Architecture diagram](/images/diagram.png)
```

Everything in `static/` is copied into `dist/` as is, so `static/images/diagram.png` is served at `/images/diagram.png`. The text inside the brackets is the alt text. Always write it, it is what screen readers read.

The visual editor edits Markdown files only. It does not upload images, so add image files to `static/` on the server or in your repository, then rebuild.

The editor preview renders image references as images; it does not suppress them. An image loads only if its URL is reachable from the editor page. Remote image URLs can contact their hosts from the preview as well as from the published page.

The editor serves local assets under `/static/`, while the built site serves the contents of that folder at its root. A reader URL such as `/images/diagram.png` can therefore work in the built site but fail in the default editor preview. Keep the correct reader URL in your Markdown and verify the image on the built page; do not change it to `/static/images/diagram.png` just for the preview.

## Links between pages

Link to another page by its URL. A page URL comes from its title, and a folder's URL part comes from the title in its `_index.md` (see [Content Model](/authoring-content/content-model/)).

```markdown
[Install MarkStack](/getting-started/installation/)
```

Use absolute paths that start with `/`. A trailing slash is optional for pages, and the site's own navigation links pages without one. Relative file paths such as `../page.md` do not work, because pages are built to folder URLs.

Link to a heading by adding its anchor after the page URL. The anchor is the heading in lowercase, with every group of characters that is not a letter or digit turned into a dash.

```markdown
[Frontmatter fields](/authoring-content/frontmatter/#the-fields-markstack-reads)
```

Hover a heading on a published page to get a link to it.

## Links to other sites

Write the full address.

```markdown
[Node.js downloads](https://nodejs.org/en/download)
```

These links open in the same tab. Bare web addresses in text become links on their own.

## Sites under a sub-folder

If you set `baseUrl` in `siteconfig.json` because the site lives in a sub-folder, such as `https://example.com/docs/`, the links in the page template (navigation, search, CSS) are adjusted for you. Links and images you write inside Markdown are not. Include the prefix yourself, for example `/docs/images/diagram.png`.

## The build does not check link targets

A link to a page that does not exist builds fine and returns a 404 for readers. After a big restructure, open the built site and click through the pages you changed.

## Links in the header

The links at the top right of every page are not part of your content. An admin manages them in the editor. See [Header Links](/editing-and-admin/header-links/).
