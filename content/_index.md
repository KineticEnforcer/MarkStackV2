---
title: MarkStack Documentation
description: MarkStack turns a folder of Markdown files into a fast, searchable knowledge base, with a built-in visual editor, user accounts and one-click publishing.
---

# MarkStack

MarkStack is a self-hosted knowledge base. You write pages in Markdown, MarkStack builds them into a plain static website, and readers get a clean documentation site with a sidebar, full-text search, a table of contents on every page and a light and a dark theme.

V2 adds a complete **visual editor** to the generator. You can write, preview and publish from a browser, give each editor access to only the sections they own, and keep the public site as static files that any web server can host.

This documentation site is built with MarkStack. Every page you read here is a Markdown file in the `content/` folder.

## What you get

- **A static site.** The output is a `dist/` folder of HTML, CSS and JavaScript. No database, no server code and no editor on the public side.
- **Folders become navigation.** Create a folder, add Markdown files, and the sidebar, breadcrumbs and previous/next links appear on their own.
- **Search that works offline from the page.** Pages and individual sections are indexed at build time. Open search with `Ctrl+K` or `/`. It ranks results, forgives small typos and understands "quoted phrases".
- **Rich Markdown.** Tables, task lists, footnotes, code with syntax highlighting and a copy button, GitHub-style alert boxes and Mermaid diagrams.
- **A visual editor.** File tree, Markdown editor, live preview, and a Publish Changes button.
- **Accounts and roles.** Administrators manage everything. Editors only see the sections assigned to them.
- **Header links.** A short list of links with icons in the top bar, managed from an admin page.
- **Light and dark themes.** The reader's choice is remembered, and code blocks, diagrams and scrollbars follow it.
- **Safe by default.** Raw HTML in Markdown is off, frontmatter is plain YAML only, the editor listens on the local machine only until you say otherwise, and a failed publish never replaces the live site.

## Where to start

| If you want to... | Read |
| --- | --- |
| Install MarkStack and see a site on screen | [Getting Started](/getting-started/) |
| Understand every folder and file in the project | [Project Structure](/getting-started/project-structure) |
| Create the first administrator and use the editor | [Set Up the Editor](/getting-started/set-up-the-editor) |
| Write pages and use all the Markdown features | [Authoring Content](/authoring-content/) |
| Manage users, sections and publishing | [Editing and Admin](/editing-and-admin/) |
| Change the site title, home page and header links | [Configuration](/configuration/) |
| Change colors, layout and templates | [Customization](/customization/) |
| Put the site on a server or a static host | [Build and Deploy](/build-and-deploy/) |
| Learn how the build works inside | [Architecture](/architecture/) |
| Fix a problem | [Troubleshooting](/troubleshooting/) |

## How it works in one minute

1. You write Markdown files in `content/`. Each one starts with a short YAML block that gives the page a title and a description.
2. `npm run build` reads the folder, converts every page to HTML, builds the sidebar and the search index, and writes the result to `dist/`.
3. You upload `dist/` to any static host, or serve it from your own machine.
4. If you use the editor, the **Publish Changes** button does the same build for you, checks it, and switches the live site to the new version only when the check passes.

> [!NOTE]
> The public site never contains the editor. The editor is a separate program that you run only where you write. Readers only ever receive static files.

## A first look

Most of the work happens in the editor. The file tree is on the left, the Markdown is in the middle and the live preview is on the right.

![The MarkStack editor in the light theme](/images/docs/editor-overview-light.png)

The same screen in the dark theme:

![The MarkStack editor in the dark theme](/images/docs/editor-overview-dark.png)

Continue with [Getting Started](/getting-started/) to install MarkStack in a few minutes.
