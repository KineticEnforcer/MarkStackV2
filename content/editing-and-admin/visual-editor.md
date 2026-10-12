---
title: Visual Editor
description: A tour of the MarkStack editor screen, with file management, live preview and keyboard shortcuts.
---

# Visual Editor

The editor shows your file tree on the left, the Markdown source in the middle and a live preview on the right. The preview loads the published site's stylesheet, but it does not reproduce every reader feature. Both themes are available, dark is the default.

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

The right panel renders the page as you type. It supports headings, emphasis, lists, tables, alerts, highlighted code and Mermaid diagrams. The published reader also adds footnotes, task-list checkboxes and heading anchors; those plugins are not installed in the preview. Check those features on a built page. See [Markdown Features](/authoring-content/markdown-features/).

Images are not suppressed. An image can load if its URL is reachable from the editor page, and a remote image can contact its host. The editor serves local assets under `/static/`, so a reader path such as `/images/diagram.png` may fail in the preview even though it works in the built site. Do not change a correct reader path just to make the preview display it. See [Media and Links](/authoring-content/media-and-links/).

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

## Unsaved drafts

Leaving the editor for Admin or another page, or signing out, offers **Stay here**, **Keep draft and leave**, or **Save and leave** when there are unsaved edits. **Save and leave** waits for the server to confirm the save. A failed save keeps the editor open. Refreshing or closing the tab uses the browser's own warning.

Returning to the editor reopens the last file if your account can still read it. **Recover draft** restores the browser-local text for review. It does not save or publish. **Use server text** opens the current saved content instead. If the saved file changed while you were away, the recovery message warns you. A confirmed save removes the draft.

Drafts are separated by account name and file path on this browser profile. They stay after sign-out and are not encrypted, so do not use them for sensitive content on a shared browser. They are not a backup: browser-data cleanup or private-browsing cleanup can remove them. If browser storage is unavailable, **Keep draft and leave** is disabled. Save before leaving instead.

Renaming the open file carries its unsaved draft to the new path. Confirmed deletion clears the open file and its draft.

## Save

Press `Ctrl+S` (`Cmd+S` on macOS) or click **Save**. If you open another file with unsaved edits, the editor asks whether to keep or discard them. If a save fails, a banner stays on screen with **Retry** so your text is not lost.

## Publish

Administrators see a **Publish Changes** button. A small dot on it means there are saved changes that are not on the public site yet. See [Publishing](/editing-and-admin/publishing/).

## Theme and small screens

The sun and moon button switches between dark and light, and the choice is remembered in your browser. The default is dark.

At 800px wide or less, the editor shows one full-width pane at a time. Use **Edit** and **Preview** to switch without losing your text. The files button opens a drawer with New File, New Folder, Refresh and Close controls. Select a page or use Close, Escape or the shaded background to return to the editor. Closed drawer controls are not part of the keyboard tab order.

On narrow phones, Save and Publish Changes have their own row; account and theme controls stay in the header. Save still writes to the server. Publish Changes still rebuilds the saved site, including changes from other editors. Switching views or closing the file drawer does neither.

Dialogs scroll within the visible screen when the keyboard leaves less space. Scroll the dialog to reach its actions. Inputs use phone-size text to avoid focus zoom. Unsaved text and local drafts keep the same safeguards as the desktop editor.

The admin uses its own Menu drawer and full-width list/detail screens. Back to users, sections or pages returns to the list; account actions remain available from the header. Desktop retains the side-by-side layout.

Responsive layout and keyboard-focus checks cover 1920px, 390px and 320px widths, including reduced-height and landscape states. Browser emulation does not replace a real phone check: test Safari with the keyboard open, rotation, Save, Preview, and admin dialogs on your device before relying on it.

## Shortcuts

| Keys | Action |
|------|--------|
| `Ctrl+S` or `Cmd+S` | Save the open file |

## What the editor does not do

- It edits Markdown only. Add images and other assets to `static/` yourself. See [Media and Links](/authoring-content/media-and-links/).
- It does not change `siteconfig.json` or templates. Those are server files.
- There is no version history inside the editor. Use Git for that.
