---
title: Deployment Guide
description: Host a MarkStack site on a static host or your own web server, with sub-folder, caching and 404 notes.
---

# Deployment Guide

The output of `npm run build` is the `dist/` folder. Deploying means putting that folder where a web server can serve it. Nothing in it needs Node.js at run time.

## What is in dist

```text
dist/
  index.html            home page
  404.html              not found page
  search-index.json     data for search
  css/  js/  svg/  images/
  getting-started/
    index.html          each page is a folder with an index.html
    installation/
      index.html
```

Every page is a folder containing `index.html`. A page is linked as `/getting-started/installation` and a section as `/getting-started/`. Any server that serves a directory's `index.html` handles both, with no rewrite rules. Most servers redirect the form without the slash to the one with it.

## Before you deploy

1. Set `siteUrl` in `siteconfig.json` to the address the site will have. It is used for the page address in social previews. See [Site Config](/configuration/site-config/).
2. Set `baseUrl` only if the site lives in a sub-folder. Leave it empty otherwise.
3. Run `npm test` and `npm run build`, and open the result with `npm run serve`.

## A static host

Any host that serves a folder of files works. The pattern is the same everywhere:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Output folder | `dist` |
| Node.js version | 24 or newer |

Many hosts can build for you from a Git repository with those settings. Others take an upload.

### Cloudflare Pages

Cloudflare Pages can build from a connected Git repository using the table above. It can also take a prebuilt folder with direct upload. At the time of writing, the Cloudflare documentation lists these limits for direct upload: a drag and drop upload accepts up to 1,000 files and 25 MiB per file, while Wrangler uploads a folder of up to 20,000 files. Check the current documentation before you rely on them.

Cloudflare serves `404.html` for unknown paths on its own. See the [direct upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Your own server

Serve `dist/` with any web server. These two examples use placeholders. Replace the host name and paths.

### nginx

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /srv/knowledge-base/dist;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
}
```

### Caddy

```text
docs.example.com {
    root * /srv/knowledge-base/dist
    file_server
    handle_errors {
        rewrite * /404.html
        file_server
    }
}
```

Check them with `nginx -t` or `caddy validate` before you reload. Both examples assume you add HTTPS the way your server normally does. Caddy does this by itself for a public host name.

## Updating the site

- **From Git:** pull, run `npm run build`, and the web server serves the new `dist/`. The build deletes and recreates `dist/`, so a visitor can hit a short gap. Build into another folder with `--out` and swap it in if that matters.
- **From the editor:** an administrator clicks Publish Changes. It builds into a temporary folder, checks it and switches it in. See [Publishing](/editing-and-admin/publishing/).

If you deploy by uploading `dist/` to a host, remember that the editor's Publish Changes only updates the folder on the editor's own server. Upload that folder again to update the public host.

## Sub-folder hosting

To serve the site at `https://example.com/docs/`, set `"baseUrl": "/docs"` in `siteconfig.json` and rebuild. Links in the template follow it. Links and images you write in Markdown do not, so include the `/docs` prefix in them. See [Media and Links](/authoring-content/media-and-links/).

## Caching

CSS and JavaScript file names stay the same between builds, and the templates add a version number to them. If readers see old styles after an update, a cached file is the usual reason. Set a short cache lifetime on `css/` and `js/`, or purge your CDN after each deploy.

## Third-party requests

Pages load IBM Plex fonts from Google Fonts and Mermaid from jsDelivr. See [Security](/editing-and-admin/security/) for what that means and how to turn it off.

## Checklist

- [ ] `siteUrl` and `baseUrl` are right for the final address
- [ ] `npm test` passes and the build finishes without errors
- [ ] The home page, a deep page, search and a made-up URL (for the 404 page) all work on the live address
- [ ] The editor, if you run one, is not reachable from the public internet without HTTPS and a sign-in
