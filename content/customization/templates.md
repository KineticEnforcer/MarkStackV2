---
title: Templates
description: The single page template, its placeholders, and safe ways to change the page structure.
---

# Templates

Every page on the site, including the home page and the 404 page, is made from one file: `templates/base.html`. The build fills in placeholders and writes the result. There are no template languages, loops or conditions to learn.

## Placeholders

| Placeholder | Replaced with |
|-------------|---------------|
| `{{title}}` | The page title |
| `{{description}}` | The page description, or the default one |
| `{{siteTitle}}` | The `headerTitle` setting |
| `{{url}}` | `siteUrl` plus the page path |
| `{{baseUrl}}` | The `baseUrl` setting, empty by default |
| `{{headerLinks}}` | The header links an administrator manages |
| `{{sidebar}}` | The navigation tree, with the current page marked |
| `{{breadcrumbs}}` | The path to the current page |
| `{{content}}` | The rendered page |
| `{{prevNext}}` | Previous and next page cards |
| `{{toc}}` | The "On this page" list |
| `{{pageClass}}` | An extra class on the main layout for some page types |
| `{{copyrightText}}` | The `copyrightText` setting. The default template does not use it |

Use `{{baseUrl}}` in front of every local link or file in the template, so a site in a sub-folder keeps working:

```html
<link rel="stylesheet" href="{{baseUrl}}/css/main.css">
```

## What is in the default template

- A small script in the head that applies the saved theme before the page paints, to avoid a flash.
- The header with the logo, search box, header links and the theme button.
- The sidebar, the article and the table of contents rail.
- Scripts at the end: search (`js/search-core.js`), the page behavior (`js/app.js`), and the Mermaid loader for diagrams.

## Common changes

### Add a footer

Add this inside `<body>`, after the main layout:

```html
<footer class="my-footer">{{copyrightText}}</footer>
```

Then set `copyrightText` in `siteconfig.json` and style `.my-footer` in `main.css`.

### Add an analytics or other script

Put your script tag before the closing `</body>`. Consider what it means for your readers' privacy, and update your own policy.

### Remove the Mermaid loader

If you never use diagrams, delete the `<script type="module">` block that imports Mermaid. Pages then make one request fewer.

## Rules

- Keep each placeholder exactly as written, with double braces.
- Do not remove `{{sidebar}}`, `{{content}}` or `{{title}}` unless you are sure. The site depends on them.
- Keep the version numbers on the CSS and JavaScript links (`?v=21`), and raise them when you change those files, so browsers fetch the new copy.
- After a change, run a build and open a normal page, the home page and the 404 page.

## Limits

- There is one template. You cannot choose a different layout per page.
- The template is not part of the content, so the editor cannot change it. Edit it on the server or in Git, then publish.
