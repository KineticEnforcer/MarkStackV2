---
title: Editing and Admin
description: The MarkStack browser editor, accounts, publishing, header links and the security model behind them.
---

# Editing and Admin

The editor is a web app that ships with MarkStack. It lets people write and organize pages in a browser, see them rendered with the real site styles, and publish them. You do not need it to use MarkStack, the Markdown files in `content/` work with any text editor and Git. It is there for teams where not everyone wants to use a terminal.

| Page | What it covers |
|------|----------------|
| [Visual Editor](/editing-and-admin/visual-editor/) | The screen, editing, files and folders, the Location picker, shortcuts |
| [Users and Roles](/editing-and-admin/users-and-roles/) | Admins, editors, section access, passwords, recovery |
| [Publishing](/editing-and-admin/publishing/) | What Publish Changes does, its stages, and what happens when a build fails |
| [Header Links](/editing-and-admin/header-links/) | The links shown at the top right of the site |
| [Security](/editing-and-admin/security/) | Sign-in protection, sessions, content limits and what is sent to third parties |

To run the editor on a server for a team, see [Team Server Setup](/build-and-deploy/team-server-setup/).

## Two things to know first

- The editor reads and writes the files in `content/`. Saving a page does not change the public site. **Publish Changes** does that, and only administrators have the button.
- The public site is static files. The editor is a separate program that you choose to run. If you never start it, nothing about your published site depends on it.
