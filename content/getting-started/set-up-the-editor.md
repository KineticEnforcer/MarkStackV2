---
title: Set Up the Editor
description: Create the first administrator, start the visual editor, sign in, write a page and publish it, with the commands to run and what you should see.
---

# Set Up the Editor

The visual editor lets you write and publish from a browser. It is a separate program from the site generator. It runs where you write, never on the public site.

This page covers the first-time setup. The full tour is in [Editing and Admin](/editing-and-admin/).

## 1. Create the first administrator

The editor has no default account. Create one with:

```bash
npm run editor:create-admin -- --user admin
```

Replace `admin` with the name you want. Names use lowercase letters, digits, dots, dashes and underscores, from 2 to 32 characters.

The command asks for a password twice at a hidden prompt. The password must be at least 12 characters and not an obvious one. It is never printed, never logged and never passed on the command line. On success you see:

```text
Administrator "admin" created in /path/to/my-docs/.markstack/users.json
```

The accounts live in `.markstack/users.json`, readable only by your user, with passwords stored as salted scrypt hashes. See [Security](/editing-and-admin/security).

> [!TIP]
> In scripts you can pipe the password in instead of typing it. It is read from standard input, never from an argument.

## 2. Start the editor

```bash
npm run editor
```

```text
📝 MarkStack Editor Server
━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Editor running at: http://127.0.0.1:3001
✓ Content directory: /path/to/my-docs/content

Press Ctrl+C to stop the server.
```

By default the editor listens on `127.0.0.1` port `3001`, so only your own computer can reach it. Use the `MARKSTACK_EDITOR_PORT` environment variable to change the port. To make it reachable from other machines you must set several variables on purpose; read [Team Server Setup](/build-and-deploy/team-server-setup) first.

## 3. Sign in

Open `http://127.0.0.1:3001` in a browser. You are sent to the sign-in page. Enter the name and password from step 1.

After too many wrong passwords the account is paused for a while, so a guessing attack gets nowhere. Sessions end after a period of inactivity and after a maximum lifetime, and they end when the editor restarts.

## 4. Look around

The editor has three areas:

- **The file tree** on the left lists your content. Folders open and close, and the buttons above the tree create files and folders.
- **The Markdown pane** in the middle is where you type.
- **The preview** on the right shows the page as you type, using `markdown-it` and the site stylesheet. It does not install the build's footnote, task-list or heading-anchor plugins. Images can load when their URLs are reachable from the editor. Check the built page for the final result. See [Visual Editor](/editing-and-admin/visual-editor/).

The top bar has **Refresh** (reload the file tree), **Save**, **Publish Changes**, your account menu and the theme toggle.

## 5. Write and save a page

1. Use the new file button above the tree, or open the menu on a folder and choose **New File**.
2. Choose the **Location**. Any folder at any depth is listed. Name the file, for example `hello`. The `.md` extension is added for you.
3. The new file opens with a starter title and description. Edit the text and watch the preview.
4. Press **Save** or `Ctrl+S` (`Cmd+S` on a Mac).

Saving writes the file in `content/`. It does not change the public site yet.

## 6. Publish

**Publish Changes** builds the site from what you saved and switches the live site to the new build. The dot on the button tells you there are saved changes that are not published yet.

Click it and the dialog shows four stages: taking a snapshot of the saved content, building, checking the new build, switching the live site. If any stage fails, the live site is left exactly as it was and the dialog shows the error. See [Publishing](/editing-and-admin/publishing).

The built site goes to `dist/`. Serve it with `npm run serve`, or point a web server at it.

## Next steps

- Add more people and limit them to sections: [Users and Roles](/editing-and-admin/users-and-roles).
- Learn each part of the screen: [Visual Editor](/editing-and-admin/visual-editor).
- Run the editor on a server: [Team Server Setup](/build-and-deploy/team-server-setup).
