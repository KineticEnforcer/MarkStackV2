---
title: Frontmatter
description: The YAML block at the top of each page. The three fields MarkStack reads, how to write them safely, and what is refused for security.
---

# Frontmatter

Frontmatter is a short block of YAML at the very top of a page, between two lines of three dashes.

```markdown
---
title: Reset a Password
description: How to reset your account password.
updated: 2026-03-05
---

# Reset a Password
```

## The fields MarkStack reads

MarkStack reads exactly three fields. Any other field you add is ignored, so it is harmless but has no effect.

| Field | Required | What it does |
| --- | --- | --- |
| `title` | Recommended | The page name in the sidebar, breadcrumbs, browser tab, search results and previous/next cards. **It also decides the page URL.** Without it, the file name is used. |
| `description` | Recommended | The text for the page's meta description and link previews. Without it, `defaultDescription` from `siteconfig.json` is used. |
| `updated` | Optional | A date shown as "Updated 5 Mar 2026" under the page title. `date` works as a fallback name. |

There are no fields for ordering, tags, drafts or authors. Pages are ordered by title, and a page you do not want published should be named with a leading dot. See [Content Model](/authoring-content/content-model).

## Writing the values

### Quote titles that contain a colon

YAML treats `: ` (a colon followed by a space) as the end of a key. A title with one must be quoted, otherwise the build fails with "bad indentation of a mapping entry".

```yaml
title: "Setup: Linux and macOS"
```

Quote a value too if it starts with a special character such as `[`, `{`, `*`, `&`, `!`, `#`, `%` or `@`, or if it contains ` #`.

### Dates

Write dates as `YYYY-MM-DD`, for example `2026-03-05`. They are shown in the form `5 Mar 2026`. A value that is not a valid date is ignored and no date is shown.

### Long descriptions

For a long description, use a folded block:

```yaml
description: >
  A longer description that wraps over
  several lines in the file.
```

Aim for one or two sentences. Search engines and link previews show roughly the first 150 to 160 characters.

## Pages without frontmatter

A file with no frontmatter still builds. It gets the file name as its title (`getting-started.md` becomes **Getting Started**) and the site's default description. Adding a real title and description is almost always worth the ten seconds.

## Section pages

Every folder's `_index.md` has frontmatter too. Its `title` becomes the section name in the sidebar and the section's URL, so choose it with care: changing it moves every page in that section to a new address.

## Only YAML is accepted

Some tools allow frontmatter written as JSON or as executable JavaScript. MarkStack does not. A page that starts with `---js`, `---javascript`, `---json` or any other language marker fails the build with an error such as:

```text
Unsupported frontmatter language "js". Only YAML frontmatter is allowed.
```

This is deliberate. Executable frontmatter would let anyone who can save a Markdown file run code on the machine that builds the site, which matters when several people can edit.

## Checklist

- [x] A title that is short, unique within its folder and stable
- [x] A description of one or two sentences
- [x] Colons in titles are inside quotes
- [x] A date only when the page really has one worth showing
