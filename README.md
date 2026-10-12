# MarkStack

**Markdown in. A searchable knowledge base out. Your files, your hosting, your workflow.**

MarkStack turns folders of Markdown into a fast static documentation site. Write with your usual editor and Git, or use the included browser editor with live preview, section-based accounts, recoverable local drafts and a full Admin console. Readers get search, clear navigation and light or dark themes without a database or a running application server on the public host.

## Privacy and security first

**Editor sign-in protects editing, not reading.** Publishing makes content readable to anyone who can reach the static host. For a family handbook, internal procedures or customer notes, use your own private network or host-level authentication. Never publish passwords, recovery codes, private addresses or confidential records.

**"Hide from sidebar" is not privacy.** Hidden sections still build, remain reachable by URL and can appear in search. Dot-prefixed files/folders are excluded from the build, but source files and backups still need protection.

**Keep runtime data private and backed up.** It holds password hashes, settings, links and activity history. Never upload it with `dist/`, commit it or serve the project root. Browser drafts stay on the device; avoid shared browsers for sensitive writing.

**The default site is not fully offline or third-party-free.** Fonts and diagram scripts use Google Fonts and jsDelivr. External media and allowed HTML add their own risks. Self-host dependencies for a disconnected or stricter environment. Use HTTPS and a reverse proxy for a team editor; keep it off the public internet where possible.

## At a glance

| Current project | Scope |
| --- | --- |
| **Node.js 24+** | Build and editor requirement |
| **2 account roles** | Administrator and section-limited editor |
| **9 Admin areas** | People, content, site and system management |
| **4 publish stages** | Snapshot, build, verify, switch |
| **39 Markdown docs** | Guides, references and section pages |
| **8 documentation sections** | Plus home content |
| **214 automated tests** | Verified baseline for this update |
| **1920 × 1080 screenshots** | Real application, synthetic data |
| **GPL-3.0** | See [LICENSE](LICENSE) |

Counts describe this revision, not capacity limits. Search-index counts include headings, not only pages.

![Reading site with synthetic documentation](static/images/readme/reader-light.png)

*Light-theme reader: navigation, breadcrumbs, metadata, highlighted code, alerts and table of contents. Screenshots use a synthetic "Field Guide" site, fictional accounts and example domains.*

## Contents

- [What is included](#what-is-included)
- [Quick start](#quick-start)
- [How the pieces fit](#how-the-pieces-fit)
- [Writing and organizing content](#writing-and-organizing-content)
- [The reading site](#the-reading-site)
- [The browser editor](#the-browser-editor)
- [The Admin console](#the-admin-console)
- [Save, publish and Git](#save-publish-and-git)
- [Configuration](#configuration)
- [Security model](#security-model)
- [Hosting and deployment](#hosting-and-deployment)
- [Backup, recovery and updates](#backup-recovery-and-updates)
- [Complete project map](#complete-project-map)
- [Commands, tests and contribution](#commands-tests-and-contribution)
- [Troubleshooting and limits](#troubleshooting-and-limits)
- [Documentation map](#documentation-map)

## What is included

Built for documentation, handbooks, runbooks and team knowledge bases. The reader is static; the optional writing tools are not.

| Part | What it does |
| --- | --- |
| Generator | Reads Markdown, YAML metadata, assets and one HTML template; writes portable `dist/` |
| Reader | Responsive navigation, heading search, themes, code copying and diagrams |
| Editor | Markdown source, live preview, file operations, explicit saving and local draft recovery |
| Admin | Accounts, sections, pages, branding, links, security state and persistent history |
| Publisher | Builds beside the live folder, checks the result, switches output and keeps one backup |
| Documentation | Setup, writing, configuration, architecture, hosting and troubleshooting |

No proprietary content format. Skip the editor, keep files in Git and build in CI, or run it privately for browser-based contributors. Neither path automatically commits or pushes content to Git.

## Quick start

### Build the reader

Install Node.js 24+ and npm:

```bash
git clone https://github.com/KineticEnforcer/MarkStackV2.git
cd MarkStackV2
npm ci
npm run build
npm run serve
```

Open the address printed by `serve`. Its first run may ask to download `serve` through `npx`. Any static server can serve `dist/` instead.

| Change | Where |
| --- | --- |
| Home content | `content/_index.md` |
| Your pages | Markdown under `content/` |
| Site identity | `siteconfig.json` |
| Images | `static/images/` |
| Logo | `static/svg/logo.svg` |
| Layout | `templates/base.html` |

Run `npm run watch` in one terminal and a static server in another for automatic rebuilds. Watch monitors content, assets and templates, not site configuration/runtime settings. It does not serve the site; refresh after a build.

### Optional browser editor

```bash
npm run editor:create-admin -- --user admin
npm run editor
```

The account command asks for a password at a hidden prompt. Open `http://127.0.0.1:3001` and sign in. The default listener is loopback only. Administrators create editors, assign sections and publish saved content.

Do not put passwords in command arguments, screenshots or committed files. Use the [team server guide](content/build-deploy/team-server-setup.md) for HTTPS and a private data folder outside the checkout.

## How the pieces fit

```text
content/ + static/ + templates/ + siteconfig.json
                + private build settings/header links
                               |
                           build.js
                               |
                             dist/
                               |
                    static web host -> readers

browser editor -> editor-server.js -> saved Markdown + private data
administrator -> Publish Changes -> snapshot/build/verify/switch
```

| Boundary | Meaning |
| --- | --- |
| Source/output | Edit source, not generated HTML |
| Reader/editor | Public host needs no Node server; editor does |
| Editor/Git | Saving writes files; versioning is separate |
| Publish/hosting | Button updates local `dist/`; remote delivery is separate |
| Accounts/privacy | Assignments restrict editing; host controls reader access |

## Writing and organizing content

```text
content/
├── _index.md               Home body
├── guides/
│   ├── _index.md           Section page and metadata
│   ├── quickstart.md       Normal page
│   └── advanced/
│       ├── _index.md       Nested section
│       └── tuning.md
└── .drafts/                Excluded from build
```

| Rule | Result |
| --- | --- |
| `.md` file | A page |
| `_index.md` | Home/section landing content |
| Folder | Section; nesting supported |
| Leading dot | File/folder excluded |
| Page `title` | Public slug, not only display label |
| Section `title` | URL segment and descendant URLs |
| Duplicate URL | Build stops instead of overwriting |

Changing a title can break links. Renaming a file with a title usually keeps the URL; without a title it can change. Slugs use ASCII letters, digits, spaces and dashes. Check non-Latin/punctuation-heavy titles for empty or colliding slugs.

Folders come first in navigation. Section `_index.md` integer `order` sorts lower first, then by title; normal pages sort by title. `hidden: true` removes a section from navigation, not output/search.

### Frontmatter

```markdown
---
title: "Setup: Linux"
description: Install and verify the tools.
updated: 2026-10-12
---

# Setup: Linux

Your page content.
```

| Field | Meaning |
| --- | --- |
| `title` | Label and slug; filename fallback |
| `description` | Page metadata; site fallback |
| `updated` | Displayed date; `date` fallback |
| `order` | Section sidebar position, integer |
| `hidden` | Section sidebar visibility, boolean |

YAML only. Executable/other language markers are refused. Quote colons and special characters. Other metadata can remain, but there are no tag/author archives or draft-state fields.

### Markdown and assets

| Feature | Behavior |
| --- | --- |
| Headings | Anchors and heading search |
| Emphasis/lists | Standard Markdown and task lists |
| Tables | Styled; copy control on reader |
| Footnotes | Linked references |
| Code fences | Syntax highlighting and copying |
| Alerts | NOTE, TIP, IMPORTANT, WARNING, CAUTION |
| Mermaid | Browser-rendered diagram fences |
| Images/links | Standard Markdown, static assets |
| Raw HTML | Off by default; trusted-author server option |

Put `diagram.png` in `static/images/`, reference `/images/diagram.png`. Media only in `content/` is not copied. The editor is not an image-upload manager.

Authored Markdown links/images are not rewritten for a `baseUrl` sub-path. Include the prefix yourself. Links are not all validated during build; click through after reorganizing. See [media and links](content/authoring/media-and-links.md).

## The reading site

| Experience | Detail |
| --- | --- |
| Navigation | Nested sidebar, active page, remembered expansion/scroll |
| Context | Breadcrumbs, updated date, reading time, previous/next |
| On this page | Heading navigation where available |
| Search | Client-side page/heading results, phrases, typo-tolerant ranking |
| Search keys | Ctrl/Cmd+K or `/`; keyboard result navigation |
| Themes | Light/dark toggle, browser-local preference |
| Copying | Code and table controls |
| Header links | Cached icons and More overflow menu |
| Phones | Responsive sidebar/reading layout |
| Metadata | Titles, descriptions, public URL metadata |
| Missing pages | Generated `404.html`; host config required |

Search reads generated `search-index.json`, not a hosted service. Each page and H2-H4 heading can be a result linking to the heading. Code blocks/diagrams are excluded from indexed prose. Hidden navigation sections remain indexed. Index size and browser work grow with content; measure your large collection instead of assuming a capacity guarantee.

<details>
<summary>Dark theme and search screenshots</summary>

![Dark reader](static/images/readme/reader-dark.png)

![Page and heading search](static/images/readme/search.png)

</details>

## The browser editor

![Markdown source and live preview](static/images/readme/editor.png)

| Tool | Behavior |
| --- | --- |
| File tree | Allowed Markdown, remembered expansion |
| Source/preview | Syntax-colored source, live rendering, synchronized scroll |
| Save | Writes current file to server |
| New file/folder | Guarded content creation |
| Rename/delete | Explicit actions; no deletion undo |
| Draft recovery | Browser-local, account/path-scoped, review before recovery |
| Leaving dirty work | Save, keep draft or stay |
| Account menu | Password actions; Admin for administrators |
| Publish | Administrator-only, shared dialog |
| Phone layout | Content drawer and Edit/Preview views |

Drafts are not server backups or published pages. Storage can be blocked, full or cleared. Recovery warns if saved server text changed and does not itself save. Other tabs' drafts do not follow renamed paths. Recover/save wanted work before reorganizing.

Preview uses the site's style and Markdown renderer, not the complete generated page with navigation/metadata. Check the reader too. This is not live collaboration, merge resolution, a review/approval workflow or a Git history viewer.

## The Admin console

Open **account menu > Admin** as an administrator. Desktop uses navigation/list/detail panels; phones use menus and back-to-list navigation. Administrator-only APIs enforce the boundary independently of the UI.

| Area | What you manage |
| --- | --- |
| Users | Accounts, access, enabled state, passwords, sessions, activity |
| Sections | Titles, folder names, position, visibility, editors, pages |
| Pages | Catalog, source path, planned URL, create/rename/delete |
| General | Titles, subtitle, description, site URL |
| Appearance | Home hero; read-only raw-HTML state |
| Header links | Address/title, order, visibility, icon refresh |
| Security | Live policy/limiter summary and your password |
| Publish & history | Current publisher and retained run summaries |
| Activity log | Exact filters and cursor-based Load more |

### Users and roles

| Role | Authority |
| --- | --- |
| Administrator | All content, top-level sections, accounts, settings, publish/history |
| Editor | Assigned top-level sections and own password; no Admin/publish |

Accounts use lowercase names, not required email addresses. Account creation/reset can require a password change. Details separate Access, Account, Sessions and Activity. Disable blocks sign-in. Password/access changes and disable end affected sessions; administrators can end sessions explicitly. The last enabled administrator cannot be disabled.

![Fictional editor section access](static/images/readme/admin-users.png)

### Sections and pages

Sections show page/editor counts. Settings preserve the Markdown body and unrelated metadata where safe; stale saves refuse changed `_index.md` files. Title/folder changes warn about URLs and drafts. Folder renames update assignments and end affected sessions. Metadata save and rename are separate steps; partial success is reported. No whole-section delete action.

Pages show saved title, source, planned URL, section and modification time. A planned URL is not proof it is live. Open in editor respects draft recovery. Create/rename/delete use the normal guarded APIs. Deletion has no console undo; keep backups.

![Section settings](static/images/readme/admin-sections.png)

### Site settings and header links

Save explicitly, then publish. Leaving dirty settings asks before discarding. Stale revisions are refused rather than overwriting another administrator's save. Browser settings cannot enable raw HTML.

Header links accept full HTTP/HTTPS addresses, order and visibility: **30 links**, **40-character titles**. Excess width goes into More. Server-side icon fetching checks public addresses, redirects, size and time, refuses SVG/private addresses and stores icons locally. Displaying a cached icon does not contact its destination; clicking the link does.

<details>
<summary>General settings and page catalog</summary>

![General settings](static/images/readme/admin-general.png)

![Saved-page catalog](static/images/readme/admin-pages.png)

</details>

### System areas

Security shows current policy, not controls for limits/unblocking. Password changes require the current password and confirmation, end other sessions and refresh this browser's session.

Activity stores event/time/actor/target; failed sign-ins have no verified actor. Exact filters run server-side. User Activity shows the latest 50 retained target records. Publish history keeps result, actor, times, page counts and failed stage, not full logs/arbitrary errors.

History survives restart. It is **local and bounded, not tamper-proof**, page version history or a multi-process audit service. `audit.jsonl` rotates at **1 MiB** with **3 archives**, about 4 MiB plus one record. Retention is size-based, not days. Crash can leave an unmatched start event; old events are not backfilled. A failed history write does not undo the action; Security shows a storage warning.

<details>
<summary>Security and activity log</summary>

![Live security policy](static/images/readme/admin-security.png)

![Synthetic operational activity](static/images/readme/admin-activity.png)

</details>

## Save, publish and Git

| Action | Effect |
| --- | --- |
| Keep draft | Unsaved text in this browser |
| Save | Markdown/settings on editor server |
| Publish Changes | All saved content into local `dist/` |
| Git commit/push | Separate source/versioning workflow |
| Remote deployment | Separate upload/hosting pipeline |

**Publish includes every saved page, including other editors' changes.** Unsaved tabs/drafts are excluded. The saved-change dot is a paths/sizes/modified-times fingerprint, not a cryptographic diff. A site never published through the editor shows the dot.

| Stage | Action |
| --- | --- |
| Snapshot | Capture saved content, settings, links/icons |
| Build | Generate in a temporary sibling folder |
| Verify | Required output, valid search JSON, page completion |
| Switch | Rename old output aside, new output into `dist/` |

One publish at a time. Closing progress does not stop it. Five-minute build timeout. Errors before switching preserve live output and source. The dialog shows stage/log/redacted diagnostics; history retains summary only.

`dist.previous` keeps **one** old build. Two renames are not a fully atomic swap: brief missing-folder interval or crash-between-renames needs recovery. This is not a zero-downtime guarantee.

![Publish confirmation](static/images/readme/publish-confirm.png)

<details>
<summary>Completed local publish history</summary>

![Successful synthetic publish in persistent history](static/images/readme/admin-publishes.png)

</details>

If the host serves this folder, readers see it. Remote hosts need your deployment pipeline. The button does not commit, push, upload to a CDN or invalidate remote caches.

## Configuration

### Site settings

`siteconfig.json` is the base. Admin writes safe overrides to private `site-settings.json`.

| Key | Purpose |
| --- | --- |
| `siteTitle` | Home hero heading |
| `headerTitle` | Brand/title suffix; base fallback to site title |
| `siteSubtitle` | Hero introduction |
| `siteUrl` | Public metadata address |
| `baseUrl` | Hosting sub-path; usually empty |
| `defaultDescription` | Metadata fallback |
| `showHero` | Home title/subtitle visibility |
| `allowRawHtml` | Server-file choice, off by default |
| `copyrightText` | Template value; current template has no footer |

Admin cannot change baseUrl, raw HTML or arbitrary policy. Maximum lengths: site title 120, header title 80, subtitle/description 300, site URL 2000. URL is blank or HTTP/HTTPS without credentials/query/fragment. Invalid override JSON stops the build.

There is no site-default theme control. Readers keep their browser preference. For design changes, edit CSS, fonts, logo or the single template.

### Environment

| Variable | Default / purpose |
| --- | --- |
| `MARKSTACK_EDITOR_HOST` | `127.0.0.1` |
| `MARKSTACK_EDITOR_PORT` | `3001` |
| `MARKSTACK_EDITOR_ALLOWED_HOSTS` | Extra accepted Host values |
| `MARKSTACK_EDITOR_MAX_BODY` | 2097152 bytes (2 MiB) |
| `MARKSTACK_USERS_FILE` | `.markstack/users.json` |
| `MARKSTACK_SESSION_IDLE_MINUTES` | 480 (8 hours) |
| `MARKSTACK_SESSION_MAX_MINUTES` | 10080 (7 days) |
| `MARKSTACK_EDITOR_COOKIE_SECURE` | Set `1` for HTTPS |
| `MARKSTACK_TRUSTED_PROXIES` | Proxy IPs or `loopback`; none default |
| `MARKSTACK_DATA_DIR` | Build-time data folder |

Build data precedence: `--data`, `MARKSTACK_DATA_DIR`, parent of `MARKSTACK_USERS_FILE`, project `.markstack/`. Editor data sits beside its users file. Point manual builds at the same intended data folder.

## Security model

| Protection | Detail |
| --- | --- |
| Passwords | Salted scrypt; 12-256 characters; common weak values refused |
| Sessions | Random token, server stores hash; memory-only |
| Cookies | HttpOnly/SameSite=Strict; HTTPS adds Secure/`__Host-` |
| Writes | CSRF token and Origin/Host checks |
| Access | Server-enforced sections and administrator boundaries |
| Files | Path containment, symlink-aware guards, Markdown-only |
| Requests | Body limits, validated inputs |
| Headers | CSP, frame denial, nosniff, no-referrer on editor |
| Frontmatter | YAML only, no executable variants |
| Raw HTML | Off unless server configuration enables it |

Sign-in failures: **5** per account/address, **30** per address, **20** per account across addresses, each over 15 minutes with a 15-minute pause. Previously successful addresses remain exempt from the account-wide pause. Counters reset on restart. Only trusted proxies may set client-address forwarding; wrong setup can group everyone behind a proxy.

Sessions end on timeout, account changes or restart. No built-in TLS, MFA, SSO or reader login. Secure the host, backups, DNS, dependencies and reverse proxy yourself.

| Browser dependency | Default |
| --- | --- |
| Editor highlighting/diagrams | Pinned jsDelivr scripts with integrity hashes |
| Reader/editor fonts | Google Fonts |
| Reader diagrams | Mermaid 11 from jsDelivr, not hash-pinned |

Blocked dependencies mean fallback fonts/diagram source. Vendor assets and adjust references for reliable offline operation. Static output does not prevent authored tracking media or host access logging.

## Hosting and deployment

```bash
npm ci
npm run build
# Deliver the CONTENTS of dist/ to the static host.
```

| Host style | Requirement |
| --- | --- |
| nginx/Caddy/Apache | Document root `dist/`; missing-page handling |
| Static platform | Node 24, `npm ci && npm run build`, output `dist` |
| Storage/CDN | Upload generated files, clean URLs and 404 handling |
| Sub-path | baseUrl plus corrected authored links/images |
| Private reader | Host/network authentication |

The build is independent of the editor. Verify clean URLs, assets, 404 behavior, metadata and caching. Repository CI checks quality; it is not a deployment workflow.

For a team editor, separate code/output/private data:

```text
/srv/knowledge-base/
├── app/
│   ├── content/
│   ├── dist/             Public document root
│   └── dist.previous/
└── data/                 Private accounts/settings/links/audit
```

Use a dedicated low-privilege service user, loopback listener, HTTPS proxy, allowed hosts, secure cookies and trusted proxies. It needs write access to content/data and the parent of dist for publishing. Never expose the source root.

[Team setup](content/build-deploy/team-server-setup.md) covers systemd/nginx; [deployment](content/build-deploy/deployment.md) covers static hosting. Examples are placeholders, not your production configuration.

## Backup, recovery and updates

| Back up | Why |
| --- | --- |
| `content/` | Source pages; editor saves do not commit |
| Private data | Accounts, links/icons, settings, activity |
| `siteconfig.json` | Base configuration |
| Modified assets/templates | Branding/layout |
| Service/proxy config | Restore a secure running service |

Dist is reproducible; dist.previous is one-build fallback; local drafts are not backups. Restore accounts/data with restrictive permissions and test access before reopening.

Rollback: confirm a valid dist.previous, no running publish and the correct served folder. Move current dist aside to an unused name, then move dist.previous to dist. This restores output only, not content/settings. Reconcile source before publishing again.

Updates: back up, check local changes before pulling, install locked dependencies, test/build/audit, restart for server-code changes (signs everyone out), publish/deploy new output. Do not blindly reset a working content checkout. No automatic updater/Git conflict resolver.

## Complete project map

### Root and generated folders

| Path | Job |
| --- | --- |
| `content/` | Markdown documentation/source |
| `static/` | Assets copied unchanged |
| `templates/` | HTML page template |
| `template/` | Starter content to copy; not live template |
| `lib/` | Build/server helpers |
| `scripts/` | Account bootstrap/recovery |
| `test/` | Node tests |
| `.github/workflows/ci.yml` | Test/build/audit CI |
| `build.js` | Generator/watch |
| `editor-server.js` | Authenticated editor/admin server |
| `editor.html` | Markdown editor |
| `admin.html` | Unified Admin UI |
| `login.html` | Sign-in/required password change |
| `admin-users.html`, `admin-links.html` | Legacy UI files; server serves unified Admin |
| `siteconfig.json` | Base site options |
| `package.json`, `package-lock.json` | Scripts/dependencies/locked installs |
| `README.md`, `LICENSE` | Guide/license |
| `.gitignore` | Local/generated/private exclusions |
| `dist/` | Generated reader; never hand-edit |
| `dist.previous/` | One previous publish |
| `dist.publish-*`, `dist.old-*` | Temporary publisher folders |
| `node_modules/` | Installed libraries |
| `.markstack/` | Default private runtime folder |

### Assets and client code

| Path | Responsibility |
| --- | --- |
| `static/css/main.css` | Reader layout/themes |
| `static/css/hljs-theme.css` | Highlight colors |
| `static/js/app.js` | Reader navigation/search/theme/copy/diagrams |
| `static/js/search-core.js` | Search matching/ranking |
| `static/js/content-controller.js` | Admin sections/pages |
| `static/js/site-controller.js` | Admin general/appearance |
| `static/js/system-controller.js` | Admin system areas |
| `static/js/publish-controller.js` | Shared publish dialog |
| `static/svg/logo.svg` | Header logo |
| `static/images/` | Images/icons/screenshots |
| `templates/base.html` | Single reader template |

### Helpers in lib/

| Module | Responsibility |
| --- | --- |
| `frontmatter.js` | YAML-only parsing |
| `content-catalog.js` | Sections/pages and metadata |
| `section-access.js` | Permissions/path guards |
| `passwords.js` | Policy/hashing/verification |
| `user-store.js` | Locked atomic account storage |
| `sessions.js` | Memory sessions/invalidation |
| `rate-limit.js` | Sign-in throttling |
| `cli-prompt.js` | CLI password input |
| `links-store.js` | Link validation/storage |
| `favicon.js` | Restricted icon fetches |
| `site-settings.js` | Overrides/revision-safe saving |
| `audit-store.js` | Bounded operational history |
| `publish.js` | Staged publisher |

### Private runtime files

| File | Treatment |
| --- | --- |
| `users.json` | Accounts/hashes; owner-only |
| `users.json.lock` | Account write lock |
| `publish-state.json` | Last editor-publish fingerprint/time |
| `links.json` | Header destinations/icon references |
| `favicons/` | Cached icons copied to output |
| `site-settings.json` | Branding overrides, mode 0640 |
| `audit.jsonl`, `.1`-`.3` | Operational log/archives, mode 0600 |

Commit code/source/assets/templates, not runtime data, installed libraries, output or secrets. External runtime paths need their own ignore/access/backup policy.

## Commands, tests and contribution

| Command | Result |
| --- | --- |
| `npm ci` | Install lockfile exactly |
| `npm run build` | Rebuild dist |
| `npm run watch` | Watch content/assets/templates |
| `npm run serve` | Local `npx serve dist` |
| `npm run clean` | Delete dist |
| `npm run editor` | Start editor |
| `npm run editor:create-admin -- --user NAME` | Create admin, hidden prompt |
| `npm run editor:reset-admin -- --user NAME` | Reset admin password |
| `npm test` | Node test suite |
| `npm audit --audit-level=high` | Dependency advisories |

```bash
npm run build -- --content ./docs --out ./public --data ./private-data
```

Options change Markdown input, output and settings/link data. **Build clears its output folder.** Never point `--out` at source or data you need.

CI uses Node 24, npm ci, tests/build/audit for configured paths. README-only changes do not trigger it unless watched paths also change. Audit is point-in-time, not a permanent security guarantee.

Before a focused PR: reproduce locally, use synthetic fixtures, check desktop/phone for UI changes, run tests/build/audit, check links and documentation. Never include private accounts/drafts in patches.

### Runtime libraries

The source package is version **1.1.4**. Locked dependencies support these jobs:

| Library | Job |
| --- | --- |
| `markdown-it` | Markdown renderer |
| `markdown-it-anchor` | Heading anchors |
| `markdown-it-footnote` | Footnotes |
| `markdown-it-task-lists` | Task lists |
| `highlight.js` | Code highlighting |
| `gray-matter`, `js-yaml` | Frontmatter/YAML |
| `chokidar` | File watching |

Node's built-in modules handle the editor's HTTP server, filesystem, password crypto and process management. Mermaid/font browser requests are separate from npm dependencies. Use the lockfile rather than choosing new versions casually; `package.json` includes a js-yaml override.

## Troubleshooting and limits

| Symptom | Check |
| --- | --- |
| YAML error | Quote special characters; YAML only |
| Duplicate URL | Conflicting title/section slugs |
| Saved but not live | Publish, then remote deploy if needed |
| Missing image | static location and public/sub-path URL |
| Section missing | Dot prefix, hidden flag, changed title |
| Access denied | Assignment, enabled account, refreshed session |
| Everyone signed out | Restart/account/session changes |
| Host/Origin refusal | Proxy/allowed-host configuration |
| Publish write error | Parent-of-dist/data permissions |
| Stale save | Preserve edits, reload, reapply |
| History warning | Permissions/space; action may already be done |
| Diagram source visible | Script availability/syntax/CSP |
| Large search count | Pages plus heading entries |

| Not built in | Alternative |
| --- | --- |
| Reader private sections | Host access control |
| MFA/SSO/TLS | Secure access layer/HTTPS proxy |
| Revision history/undo | Git/backups |
| Live collaboration/merges | Review workflow |
| Remote CDN publish | Deployment pipeline |
| Tags/blog feeds/translations | Custom work/another tool |
| Plugins/multiple page layouts | Edit generator/template |
| Image upload/comments/dynamic app | External tools/custom development |
| Guaranteed offline mode | Self-host dependencies |
| Unlimited audit retention | External backups/logging |

## Documentation map

**39 Markdown files in 8 sections plus home content.** Build them to read through MarkStack, or open the source guides below.

| Section | Guides |
| --- | --- |
| Getting started | [Installation](content/getting-started/installation.md), [quickstart](content/getting-started/quickstart.md), [structure](content/getting-started/project-structure.md), [editor setup](content/getting-started/set-up-the-editor.md) |
| Authoring | [Model](content/authoring/content-model.md), [frontmatter](content/authoring/frontmatter.md), [Markdown](content/authoring/markdown-features.md), [media](content/authoring/media-and-links.md), [examples](content/authoring/examples.md) |
| Editing/Admin | [Editor](content/editing-and-admin/visual-editor.md), [users](content/editing-and-admin/users-and-roles.md), [sections/pages](content/editing-and-admin/sections-and-pages.md), [settings](content/editing-and-admin/site-settings.md), [links](content/editing-and-admin/header-links.md), [publish](content/editing-and-admin/publishing.md), [security](content/editing-and-admin/security.md), [system](content/editing-and-admin/system.md) |
| Configuration | [Site](content/configuration/site-config.md), [home](content/configuration/homepage-content.md) |
| Build/deploy | [Commands](content/build-deploy/commands.md), [hosting](content/build-deploy/deployment.md), [CI](content/build-deploy/automated-builds.md), [team server](content/build-deploy/team-server-setup.md) |
| Customization | [Styling](content/customization/themes-and-styling.md), [templates](content/customization/templates.md) |
| Architecture | [Pipeline](content/architecture/build-pipeline.md), [navigation](content/architecture/navigation-and-routing.md), [search](content/architecture/search-and-indexing.md) |
| Troubleshooting | [Issues](content/troubleshooting/common-issues.md), [FAQ](content/troubleshooting/faq.md) |

## License and author

Public identity: **KineticEnforcer**. Licensed under [GPL-3.0](LICENSE); read the terms before redistribution/modification. No commercial hosting service is required.
