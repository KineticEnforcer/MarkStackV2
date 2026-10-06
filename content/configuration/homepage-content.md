---
title: Homepage Content
description: Control the home page with the hero and a content/_index.md file.
---

# Homepage Content

The home page is built from two optional parts: a hero from `siteconfig.json`, and Markdown from `content/_index.md`. The sidebar and search work on it as on any page.

## The hero

The hero is the large heading and subtitle at the top. It uses `siteTitle` and `siteSubtitle`. Hide it with `"showHero": false`. It also stays hidden if both settings are empty.

## The content

Anything you write in `content/_index.md` is rendered below the hero, with the full Markdown feature set.

```markdown
---
title: Home
description: Guides and reference for Acme products.
---

## Start here

- [Install](/getting-started/installation/)
- [Quick start](/getting-started/quickstart/)
```

Only the `description` from the frontmatter is used. It becomes the home page's description in search and link previews. The home page title is always "Home".

If `content/_index.md` does not exist, the home page shows just the hero.

## Ideas

- **Hero only.** A short welcome, with the sidebar as the way in.
- **A landing page.** Turn the hero off and write your own top heading in `_index.md`, followed by a table that links to the main sections.
- **Task first.** Put the three most common questions as links under the hero.

## Tips

- Use `##` headings. The hero already provides the top heading. With two or more `##` headings the page also gets the "On this page" list on the right.
- Link with absolute paths that start with `/`, for example `/guides/`.
- Keep it short. Readers will mostly use the sidebar and search.
