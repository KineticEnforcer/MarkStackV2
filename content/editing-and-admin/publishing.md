---
title: Publishing
description: What Publish Changes does, what it checks, how it keeps a backup, and what to do when it fails.
---

# Publishing

Saving a page writes a Markdown file. It does not change the public site. **Publish Changes** rebuilds the site from the saved files and puts the new version live. Only administrators see the button.

![The Publish Changes dialog](/images/docs/publish-dialog-light.png)

## The stages

The dialog shows a progress bar and four stages.

1. **Taking a snapshot of the saved content.** The content, header links and their icons are copied in one pass. A save made while the build runs cannot change which pages the build sees.
2. **Building the site.** The normal build runs on the snapshot into a temporary folder next to the live one, such as `dist.publish-<id>`. The dialog shows pages built out of the total.
3. **Checking the new build.** The build must contain `index.html`, `404.html` and a valid `search-index.json`, and every page must have been generated.
4. **Switching the live site.** The live folder is renamed aside and the new one is renamed into place. The old version is then kept as `dist.previous`.

Publishing builds from everything in `content/`, `static/`, `templates/` and `siteconfig.json`, including pages saved by other editors. Close the dialog if you like, the publish keeps running. Only one publish can run at a time.

## The unpublished marker

A dot on the button means files changed since the last publish from the editor. MarkStack compares a fingerprint of paths, sizes and modified times, so deletes, renames and config changes count too. A site that was never published from the editor always shows the dot.

If the file you have open has unsaved edits, the dialog warns you. Save first or those edits are not included.

## When a build fails

If any stage before the switch fails, the live site is not touched. The dialog names the failed stage, shows the error and the build log, and has a **Copy diagnostics** button that copies a report with secrets removed. Typical causes:

- A page whose frontmatter is not valid YAML, such as a title with a colon that is not quoted.
- Two pages that would end up at the same URL. The message names both pages. Change one title.
- The build taking longer than five minutes, which stops it.
- The editor's user having no write permission on the folder that holds `dist/`.

Saved files are never changed by a failed publish. The switch itself is two folder renames, so a crash or power loss between them is outside this guarantee. The rollback steps below cover that case too.

## Backups and rollback

After a successful publish the previous live folder is `dist.previous`, next to `dist`. Only one backup is kept, so the next publish replaces it. To roll back by hand on the server, with the web server pointing at `dist`:

```bash
mv dist dist.bad
mv dist.previous dist
```

## Limits

- The switch is two renames, not one atomic step. A request that arrives in the few microseconds between them can get a 404.
- Publishing replaces the folder the editor knows as `dist/`. If your public site is deployed elsewhere, for example uploaded to a static host from your own machine, publishing only updates the local copy. See [Deployment Guide](/build-and-deploy/deployment-guide/).
- A failure to write the backup is reported in the log, but the new site stays live.
