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

Open the account menu at the top right of the editor and choose **Admin**, then **Users**.

Users has a searchable account list beside the selected account. On mobile, select an account to open its detail screen and use **Back to users** to return.

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


## User detail tabs

Select an account in **Admin > Users** to open its detail pane. On a phone, **Back to users** returns to the account list. Search and the selected account stay in the console.

| Tab | Use it for |
|---|---|
| Access | Switch individual sections between **Can create, edit, rename, delete** and **Hidden**. Use **Select all** or **Select none**, then **Save changes**. **Discard** restores the saved assignments. |
| Account | Read the username, role, status, creation time and last sign-in. Enable or disable an account, or reset an editor password. |
| Sessions | See active session sign-in and last-active times. **Sign out everywhere** ends every session for the selected user. |
| Activity | See up to 50 retained events for this account from persistent bounded history. |

### Save section access

Section toggles are a draft until you click **Save changes**. Saving shows **Saving...**, then **Saved. Sessions ended.** A real server error leaves your changes in the pane so you can retry. Switching accounts or areas, returning to the editor, signing out or using the mobile back control asks before discarding changes. Refreshing or closing the page uses the browser's unsaved-changes warning.

Saving section access ends the user's sessions, so they must sign in again. Administrators have access to every section and do not have editable section toggles. A missing assigned folder is labelled **folder not found** so you can remove an old assignment without losing it silently.

### Account and session actions

An editor password reset ends their sessions and shows a one-time temporary password. They must change it when they next sign in. An administrator cannot disable their own account, and the server refuses to disable the last active administrator. Role and username are read-only; changing roles is not supported by the user store.

**Sign out everywhere** asks for confirmation and invalidates the account's current access version as well as ending the server's sessions. If you select your own account, your current session ends too and you return to sign-in. Browser-local Markdown drafts are not deleted by this action.

### Times and recent activity

Last sign-in is stored in the existing owner-only user file after a successful sign-in. Existing accounts show **Never** until they sign in again. Checking a password during a password change does not count as a sign-in. Active sessions are in memory and reset on server restart. Recorded activity persists with size-capped rotation; select the account again to refresh it.

Recent activity contains event names, account targets and times, without passwords, session tokens, CSRF values or IP addresses. This tab is a bounded view of retained audit history. System > Activity log supports filters and pagination. History is local, size-limited and not tamper-proof.
