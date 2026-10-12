---
title: System Areas
author: KineticEnforcer
---

# System Areas

**Only administrators can use these areas and APIs. Passwords, session tokens, CSRF values and client IP addresses are never included in this history. History is local and bounded, not tamper-proof.**

## Security

Open **Admin > Security**. Refresh reads the current server settings rather than a hardcoded summary.

| Item | Meaning |
|---|---|
| Session limits | Current idle and maximum lifetimes, in minutes. Defaults: 480 minutes idle, 10080 minutes maximum. |
| Cookie | Production HTTPS mode uses `__Host-ms_session`, Secure, HttpOnly, SameSite=Strict and Path=/. Local HTTP mode shows `ms_session` and a warning that this is not production HTTPS mode. |
| Raw HTML | Read-only server state. Browser settings cannot turn it on. |
| Access | Editors are limited to their assigned sections. Management is administrator-only and writes require CSRF. |
| Account + address limiter | Default 5 failed attempts in 15 minutes, then a 15-minute pause for that account/address pair. |
| Address limiter | Default 30 failures in 15 minutes, then a 15-minute pause. |
| Cross-address account limiter | Default 20 failures in 15 minutes. Previously successful addresses remain exempt from this account-wide pause. |

The overview shows current thresholds and blocked-group counts without exposing account/address keys. These counts are in memory and reset on restart. Activity log can filter failed and blocked sign-in events by target account, without showing addresses. The UI cannot change policy or unblock clients.

### Change your password

1. Enter your current password, a new unique password, and the new password again.
2. Choose **Change password**. Server validation applies, including length and weak-password checks.
3. Success clears the fields, ends other sessions and keeps this browser signed in with a fresh session/CSRF token.

Unsaved password fields prompt before leaving the area or signing out. Refresh/tab close uses the browser warning. An error keeps the form and displays the real error. Passwords are not saved in drafts, history or storage. Administrators locked out of their account still use the existing server command recovery procedure.

## Activity log

Open **Admin > Activity log**. Records show time, event, actor and target. A failed/blocked sign-in has no verified actor. Exact event, actor and target filters are applied on the server. **Load more** uses a record cursor, so events with equal timestamps do not skip each other. The initial page has 50 records; API pages are capped at 100. A rotation that removes the cursor may end that page sequence; apply the filters again to see retained records.

| Events | Recorded data |
|---|---|
| Sign-in, failed/blocked sign-in, sign-out, password change | Time, event, account target and verified actor when available |
| Create/enable/disable/reset account, access changes, end sessions | Acting administrator and target account |
| Section settings/rename, links/settings save | Acting administrator and target section or account |
| Publish start/done/failure | Actor plus completion summary for finished runs |

Only event fields are stored, never request bodies or arbitrary build errors. Earlier activity from before this phase is not backfilled. The user's Activity tab reads the latest 50 retained records for that target.

## Publish & history

Open **Admin > Publish & history**. Current state and the saved-change indicator use the existing publisher. **Publish Changes** opens the same confirmation/progress/failure dialog as the header, rather than starting another publishing implementation. Refresh updates the current summary and history.

History is newest first, 25 records initially, with **Load more**. Finished runs show result, actor, start/end times, generated/total pages and failed stage. It persists across server restart. Build logs and detailed error messages are not stored in history; inspect the current dialog for the detailed failure report. A crashed process can leave a start event without a completion record. The UI does not retry, roll back or merge anything automatically.

## Storage, retention and backup

| File | Policy |
|---|---|
| `audit.jsonl` | Append-only in normal operation; owner-only mode 0600. In existing runtime data folder. |
| `audit.jsonl.1` to `.3` | Three rotated archives, newest `.1`. Active file rotates at 1 MiB, so about 4 MiB plus one record is retained. |

Publish history uses the same retained events. Retention is based on size, not days. The files can be edited or removed by a server operator and are not tamper-proof. Keep backups with users, settings, links and content. The editor is a single process; this history is not a multi-process audit service.

If a history write fails, the underlying action remains completed; Security shows a storage warning and the server logs the error. Check directory permissions and free space. A successful later append clears the warning. Invalid record lines are skipped on read. No new port, dependency or environment variable is required, and no existing content is rewritten.
