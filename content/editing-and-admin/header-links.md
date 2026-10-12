---
title: Header Links
description: Add links to the top right of every page, with automatic icons, from the admin screen.
---

# Header Links

The top bar of the public site has the logo and title on the left and the search box. Links you add here appear to the right of search. They are meant for a few destinations: a product site, a status page, a community, a code repository.

Header links is a full-width settings area inside the Admin console.

## Manage the links

An administrator opens the account menu in the editor and chooses **Admin**, then **Header links**. Each link has:

- **Title**, up to 40 characters. It is the label on the button.
- **Address**, a full `http` or `https` address.
- **Show in the header**, to hide a link without deleting it.

Each row has up and down arrows to set the order, plus Edit and Remove. The order on the page is the order in the bar.

You can add up to 30 links. Links that do not fit the bar move into a **More** menu.

## Icons

When you add a link or change its address, the server fetches the site's favicon and stores it in the data folder, so visitors never contact the other site to draw your header. Tick **Fetch the icon again** to refresh it. If no icon can be found, the link is shown with a generic icon.

The fetch is restricted on purpose. Only public addresses are allowed, redirects are checked, the size and time are limited, and SVG icons are refused.

## They are baked in at build time

Header links are written into every page when the site is built. After you change them, run **Publish Changes** (or `npm run build` if you build by hand) for the public site to show them. The unpublished marker on the publish button includes link changes.

The links and icons live in `links.json` and `favicons/` inside the data folder, `.markstack/` by default. They are not part of `content/`, so back up that folder too.

## Header links or content links

Use header links for destinations that belong on every page. Use normal Markdown links inside pages for everything else. See [Media and Links](/authoring-content/media-and-links/).
