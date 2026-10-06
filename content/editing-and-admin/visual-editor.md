---
title: Visual Editor
description: A tour of the MarkStack editor screen, with file management, live preview and keyboard shortcuts.
---

# Visual Editor

The editor shows your file tree on the left, the Markdown source in the middle and a live preview on the right. The preview uses the same stylesheet as the published site, so headings, tables, code blocks and alerts look the way readers will see them. Both themes are available, dark is the default.

![The editor with the file tree, Markdown source and live preview](/images/docs/editor-overview-light.png)

## Start the editor

Create the first administrator once, then start the server. The full walk-through is in [Set Up the Editor](/getting-started/set-up-the-editor/).

```bash
npm run editor:create-admin -- --user admin
npm run editor
```

Open `http://localhost:3001` and sign in. The editor listens on `127.0.0.1` by default, so only the same computer can reach it.

## The screen

### File tree

The left panel lists everything in `content/`.

- Top-level folders are the sections of the site. Nested folders open and close with a chevron, and the editor remembers which ones you left open for the length of your browser tab session.
- The open file is highlighted. A marker next to the editor shows unsaved, saving and saved states.
- Right-click an item, or use its "..." button, to rename it, delete it, or create something inside it.
- **Refresh** reloads the tree. Use it when another person or a script changed files.

### Markdown source

The middle panel is a plain text editor with Markdown highlighting for headings, emphasis, links, code and frontmatter, and line numbers on wide screens. It is a standard browser text area, so your usual keyboard shortcuts and your system's spell check work. The Tab key moves focus, as in any form.

Use **Hide editor** above the source to collapse it and read only the preview. A button brings it back.

### Preview

The right panel renders the page as you type, with a short delay so typing stays smooth. It supports everything the site supports: tables, task lists, footnotes, alerts, highlighted code and Mermaid diagrams. See [Markdown Features](/authoring-content/markdown-features/).

### Scroll sync

**Sync Scroll** keeps the source and preview aligned while you scroll either one. Switch it off if long code blocks or diagrams make the alignment drift.

## Create files and folders

The buttons above the tree create a new file or folder. The same actions are in the right-click menu of any folder.

Every dialog has a **Location** drop-down that lists the folders you may use, as full paths such as `guides/setup/`. Folders at any depth are available, and the folder you right-clicked is already selected. Then:

- **New file:** type a name. File and folder names are cleaned up to lowercase letters, digits, dash, underscore and dot, with spaces turned into dashes, and `.md` is added to files if you leave it out. The file opens with starter frontmatter and its parent folders open in the tree.
- **New folder:** type a name. The folder is created with an `_index.md`, which is what gives the section its title in the sidebar and URL.

![The New File dialog with the Location drop-down](/images/docs/location-dialog-light.png)

Administrators can also pick the top level. Editors only see folders inside the sections assigned to them, so they cannot create anything outside those. See [Users and Roles](/editing-and-admin/users-and-roles/).

> [!NOTE]
> A page URL comes from its title, not its file name. Change the `title` in the frontmatter and the URL changes at the next publish. See [Content Model](/authoring-content/content-model/).

## Rename and delete

Rename changes the file or folder name on disk. Delete asks for confirmation first.

> [!CAUTION]
> Deleting a folder removes every file inside it, and the editor has no undo. Keep your content in Git or in backups if that matters to you.

A section root, which is a top-level folder, can only be renamed or deleted by an administrator. An editor also cannot move a file into another section.

## Save

Press `Ctrl+S` (`Cmd+S` on macOS) or click **Save**. If you open another file with unsaved edits, the editor asks whether to keep or discard them. If a save fails, a banner stays on screen with **Retry** so your text is not lost.

## Publish

Administrators see a **Publish Changes** button. A small dot on it means there are saved changes that are not on the public site yet. See [Publishing](/editing-and-admin/publishing/).

## Theme and small screens

The sun and moon button switches between dark and light, and the choice is remembered in your browser. The default is dark.

The editor is designed for desktop screens, and that is the tested experience. Below 800px wide it switches to one pane at a time with an Edit and Preview switch, and the file tree becomes a drawer opened from the menu button. Treat that small-screen layout as basic.

## Shortcuts

| Keys | Action |
|------|--------|
| `Ctrl+S` or `Cmd+S` | Save the open file |

## What the editor does not do

- It edits Markdown only. Add images and other assets to `static/` yourself. See [Media and Links](/authoring-content/media-and-links/).
- It does not change `siteconfig.json` or templates. Those are server files.
- There is no version history inside the editor. Use Git for that.
