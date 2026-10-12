---
title: Security
description: How the MarkStack editor protects accounts and content, what it sends to third parties, and what you must set up yourself.
---

# Security

The published site is a folder of static files, so MarkStack runs no code, login or database on the public host. Your web server, CDN, TLS and DNS setup, and the scripts the pages load in the reader's browser, still matter and are yours to secure. The editor is a Node.js server, and this page describes how it is protected. Treat it as an internal tool: run it where your team can reach it and the internet cannot, or behind HTTPS with a reverse proxy.

## Reachability

By default the editor listens only on `127.0.0.1`. Set `MARKSTACK_EDITOR_HOST` to expose it, and when you put it behind a proxy, list the public host names in `MARKSTACK_EDITOR_ALLOWED_HOSTS`. Requests with another `Host` header are refused. See [Team Server Setup](/build-and-deploy/team-server-setup/).

## Accounts

- Sign-in is required for every API call and every page except the login page.
- Passwords are stored as salted scrypt hashes. Minimum 12 characters, maximum 256, and a list of very common passwords is refused.
- `users.json` is created readable only by its owner.
- Failed sign-ins are limited in three ways, each over 15 minutes with a 15 minute block:
  - 5 failures for the same account from the same address block that account at that address, so a guesser on one address cannot lock the real user out elsewhere.
  - 30 failures from one address block that address, which stops one address from trying many accounts.
  - 20 failures for one account from all addresses together pause that account for addresses it has not signed in from before. Addresses it has used stay allowed.
  - The counters are kept in memory and reset when the editor restarts.
- A password change, a section change or disabling an account ends that person's sessions.

## Sessions

- A session token is random, and only its hash is kept on the server.
- The cookie is `HttpOnly` and `SameSite=Strict`. Set `MARKSTACK_EDITOR_COOKIE_SECURE=1` when you serve the editor over HTTPS, and it also gets the `Secure` flag and a `__Host-` name.
- Sessions end after 8 hours without activity or 7 days in total. Change that with `MARKSTACK_SESSION_IDLE_MINUTES` and `MARKSTACK_SESSION_MAX_MINUTES`.
- Sessions live in memory. Restarting the editor signs everyone out.
- Every change request needs a CSRF token and is checked against the `Origin` and `Host`.

## Behind a reverse proxy

The editor uses the client address for the sign-in limits. It reads `X-Forwarded-For` only when the connection comes from an address listed in `MARKSTACK_TRUSTED_PROXIES` (or the word `loopback`). Without that, every visitor looks like the proxy and the limits would apply to everyone at once.

## Content access

- Editors reach only their assigned sections. Anything outside answers "not found", so other sections' file names are not revealed.
- Paths are checked after following symbolic links, so a link inside `content/` cannot lead outside it.
- Only `.md` files are listed and edited. Request bodies are limited to 2 MB by default (`MARKSTACK_EDITOR_MAX_BODY`).

## Headers and third parties

The editor sends `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` and a Content-Security-Policy.

Be aware of what browsers load from other hosts:

| Where | What | From |
|-------|------|------|
| Editor | highlight.js and Mermaid scripts, pinned with integrity hashes | cdn.jsdelivr.net |
| Editor and public site | IBM Plex fonts | fonts.googleapis.com and fonts.gstatic.com |
| Public site | Mermaid (version 11, not pinned by hash), requested on every page | cdn.jsdelivr.net |

If these requests are a problem for your visitors or your policy, you can block them. Pages still render with fallback fonts, and diagrams then appear as their source text. To remove the dependency completely, host the font and script files yourself and change the templates.

## Raw HTML

Raw HTML in Markdown is off. An administrator of the server can allow it with `allowRawHtml` in `siteconfig.json`, which the editor cannot change. Turn it on only if every editor is fully trusted, because raw HTML can run scripts on your public pages.

## What is not covered

- There is no two-factor sign-in.
- Admin includes Security, Activity log and Publish & history. Operational events persist in a bounded local `audit.jsonl` with rotated archives; it is not tamper-proof or page version history. Passwords, tokens, request bodies, client addresses and arbitrary build errors are not included. See [System Areas](/editing-and-admin/system-areas/).
- There is no built-in HTTPS. Use a reverse proxy.
