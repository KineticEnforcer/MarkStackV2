---
title: Users and Roles
description: Create editor and administrator accounts, limit editors to sections, and recover access.
---

# Users and Roles

The editor needs a sign-in. There are no anonymous sessions and no default account.

## Roles

| | Administrator | Editor |
|---|---|---|
| Edit pages | Everywhere | Only in assigned sections |
| Create or delete top-level sections | Yes | No |
| Rename or delete a section root | Yes | No |
| Publish Changes | Yes | No |
| Manage users and header links | Yes | No |
| Change own password | Yes | Yes |

A **section** is a top-level folder in `content/`. An editor assigned to `guides` can create, edit, rename and delete everything inside `guides/`, but cannot rename or delete the `guides` folder itself, and does not see other sections at all. Files that sit directly in `content/`, such as the home page, are outside every section, so only administrators can edit them. Editors cannot move a file into another section.

Section names must be lowercase letters, digits, dash or underscore. A top-level folder with capitals or spaces in its name cannot be assigned to an editor, so name section folders that way from the start.

## The first administrator

Create it from the server's terminal.

```bash
npm run editor:create-admin -- --user admin
```

The password is typed at a hidden prompt. It is never a command line argument, so it does not land in shell history.

## Add and manage people

Open the account menu at the top right of the editor and choose **Users and sections**.

![The Users and sections page](/images/docs/admin-users-light.png)

From there an administrator can:

- add a user with a name, a role and an initial password
- choose which sections an editor may change
- disable or enable an account
- reset an editor's password

Rules for accounts:

- Names are 2 to 32 characters: lowercase letters, digits, dot, underscore and dash, starting with a letter or digit.
- Passwords need at least 12 characters, at most 256, and must not be on a list of very common passwords.
- You cannot disable your own account.

Changing a person's sections or disabling them signs them out right away.

## Password reset

An administrator can reset an editor from the users page. MarkStack shows a one-time temporary password. The editor must choose a new password at the next sign-in before doing anything else.

Administrator passwords are not reset in the browser. Someone with shell access to the server runs:

```bash
npm run editor:reset-admin -- --user admin
```

It asks for the new password, re-enables the account if it was disabled and ends that account's open sessions. Shell access is the trust boundary here: anyone who can run the command can already read the user file.

## Where accounts are stored

Accounts are in `users.json` inside the data folder, `.markstack/` by default. Set `MARKSTACK_USERS_FILE` to use another path. The file is created readable only by its owner and holds salted password hashes, never passwords. Back it up with the rest of the data folder. See [Security](/editing-and-admin/security/).
