---
title: Site Settings
author: KineticEnforcer
---

# Site Settings

**Only administrators can read or change these settings. Saving does not publish. Raw HTML stays a server-only choice.**

## General

Open **Admin > General**.

| Field | Used for |
|---|---|
| Site title | The home hero heading. Maximum 120 characters. |
| Header title | The brand label and document title suffix. Maximum 80 characters. |
| Subtitle | The home hero introduction. Maximum 300 characters. |
| Default description | Page descriptions when a page has no own description. Maximum 300 characters. |
| Site URL | Absolute origin/path used for public metadata URLs. Blank or HTTP/HTTPS without credentials, query or fragment. Maximum 2000 characters. |

Titles cannot be empty. **Save changes** validates on the server, then writes the override file. **Discard** restores the loaded values. Moving to another area, returning to the editor or signing out asks before discarding edits. Refresh or tab close uses the browser warning. A real save error keeps your values so you can retry.

If another administrator changed settings since your page loaded, the server refuses the stale save. Preserve any desired edits, reload, then apply them to the current values.

## Appearance

Open **Admin > Appearance**. **Show home hero** controls the existing title/subtitle block above home content. Save, then publish. The raw-HTML state is read-only and comes from server `siteconfig.json`, never from the browser override file.

The current build has no configurable default theme. Readers keep their own theme preference. The current template does not render a footer, so there is no inactive footer control.

## Publish and storage

**Publish Changes** updates the public site after saving. The publisher includes settings in its unpublished indicator and snapshots settings with content. A settings change during a build waits for the next publish; it does not alter the running snapshot.

The override file is `site-settings.json` in the existing data directory, alongside header links. It is written atomically with file mode 0640 and backed up with the rest of the data directory. The build applies only known safe keys over `siteconfig.json`. `allowRawHtml` and other unknown keys are ignored. Invalid settings or damaged JSON stop the build rather than quietly change policy. Site text is escaped when placed in generated HTML.

No new port, dependency or environment variable is required. Existing `--data`, `MARKSTACK_DATA_DIR` or `MARKSTACK_USERS_FILE` data-folder selection also applies to settings.
