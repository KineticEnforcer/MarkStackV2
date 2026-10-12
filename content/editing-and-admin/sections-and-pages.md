---
title: Sections and Pages
author: KineticEnforcer
---

# Sections and Pages

**Administrator-only. A hidden sidebar section is still public if someone knows its URL. Use editor account assignments for editing access, not sidebar visibility.**

## Sections

Open **Admin > Sections**. Search the title or folder name, then select a section. The list shows page and assigned-editor counts. Desktop keeps navigation, list and details together. On a phone, **Back to sections** returns to the list.

| Tab | Controls |
|---|---|
| Settings | Display title, folder name, sidebar position, Hide from sidebar, Save changes, Discard. |
| Editors | Add or remove an editor's section access with confirmation. Sessions end immediately. |
| Pages | See the section's Markdown files and open their detail in Pages. |

### Save settings

Edits do not write content until **Save changes**. Leaving an area, returning to the editor or signing out asks before discarding unsaved changes. A save error keeps your values so you can retry. If `_index.md` changed since you loaded it, saving refuses to overwrite it. Reload after preserving any edits you want to keep.

Settings use `title`, `order` and `hidden` in `_index.md` YAML frontmatter. The body and unrelated metadata stay intact. If unusual YAML cannot be preserved safely, use **Pages > _index.md > Open in editor** instead. Lower sidebar positions come first; equal positions sort by title. Hidden sections disappear from sidebar navigation but are still built. **Publish Changes** applies the saved navigation settings.

### Titles and folder names

A section's title determines its public URL slug. Changing it can break old links. The console asks before saving title or folder changes. Renaming the folder updates editor section assignments and ends affected sessions. Metadata saving and folder renaming are separate steps: if metadata saves but rename fails, the error says so. Retry the rename or reload the saved values.

Browser drafts in other tabs keep their original paths. Recover and save them before a folder rename. The public site's existing duplicate-URL guard still rejects titles that produce colliding output URLs.

**New section** asks for a folder name and creates `_index.md`. Only administrators can create a top-level section. The console does not delete whole sections; this avoids hiding a bulk content deletion behind a settings action.

## Pages

Open **Admin > Pages** and search a title or source path. Select a page to see its title, source path, planned public URL, section and last-modified time. The URL reflects the current saved titles; the live site changes only when published.

| Action | Result |
|---|---|
| Open in editor | Opens the selected authorized file. A local unsaved draft still prompts for recovery. |
| New page | Asks for a filename and section, then creates Markdown through the normal file API. |
| Rename file | Uses the normal safe rename API. A page without a frontmatter title may get a new URL. |
| Delete page | Asks for confirmation, then permanently removes the source file. Publish removes it from the live site. |

Delete has no undo in the console. Keep content backups. Browser-local drafts do not follow renames made from Admin or another tab. Renaming an open file inside the Markdown editor carries that editor's current draft, but does not move drafts in other tabs.

The catalog skips symbolic links rather than following them. The same server-side path and section protections still apply to file actions. No new deployment settings or data migration are needed.
