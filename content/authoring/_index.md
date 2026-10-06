---
title: Authoring Content
description: Everything about writing pages in MarkStack - how files become pages, what goes in the frontmatter, every Markdown feature, images and links, and worked examples.
---

# Authoring Content

Pages are Markdown files. This section explains how they turn into a site and everything you can put in them.

## In this section

| Page | What it covers |
| --- | --- |
| [Content Model](/authoring-content/content-model) | How files and folders become pages, URLs and the sidebar |
| [Frontmatter](/authoring-content/frontmatter) | The YAML block at the top of every page and the three fields MarkStack reads |
| [Markdown Features](/authoring-content/markdown-features) | Headings, tables, code, alerts, task lists, footnotes and diagrams, with examples |
| [Media and Links](/authoring-content/media-and-links) | Images, internal and external links, and downloads |
| [Examples](/authoring-content/examples) | Complete pages you can copy: a guide, a reference page, a FAQ and a changelog |

## The short version

1. Put a `.md` file in a folder under `content/`.
2. Start it with a title and a description between two `---` lines.
3. Write Markdown below.
4. Build, or save in the editor and publish.

```markdown
---
title: Reset a Password
description: How to reset your account password.
---

# Reset a Password

1. Open **Settings**.
2. Choose **Security**.
3. Select **Reset password**.
```

That is a complete page. It gets a place in the sidebar, a URL, breadcrumbs, search entries, a reading time and previous/next links automatically.

> [!TIP]
> You can write in any text editor, or in the built-in [visual editor](/editing-and-admin/visual-editor) with a live preview. Both produce the same files.
