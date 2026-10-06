---
title: Build and Deploy
description: Build your MarkStack site, preview it locally, and host it on any static host or your own server.
---

# Build and Deploy

`npm run build` turns `content/` into a folder of plain HTML, CSS and JavaScript called `dist/`. That folder is the whole site. You can host it anywhere that serves files.

| Page | Use it for |
|------|------------|
| [Commands Reference](/build-and-deploy/commands-reference/) | Every npm script and build option |
| [Deployment Guide](/build-and-deploy/deployment-guide/) | Static hosts, your own web server, sub-folders, caching |
| [Team Server Setup](/build-and-deploy/team-server-setup/) | Running the editor on a server for a team, behind HTTPS |
| [Automated Builds](/build-and-deploy/automated-builds/) | Building and testing in CI |

## Two ways to run it

**Static only.** Write in Git, build in CI or on your machine, upload `dist/`. There is no server process, no login to protect and nothing to patch on the host.

**Static plus editor.** Run the editor on a server next to `dist/`. People write in the browser and an administrator clicks Publish Changes to replace `dist/` in place. A web server such as nginx or Caddy serves `dist/` to readers. The editor is a separate process that readers never talk to.

You can combine them: keep `content/` in Git and let the editor work on a checkout of it.
