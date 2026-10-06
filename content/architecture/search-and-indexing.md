---
title: Search and Indexing
description: How MarkStack search works with no server, what is indexed, how results are ranked, and its limits.
---

# Search and Indexing

Search runs entirely in the reader's browser. The build writes `search-index.json`, and a small script (`js/search-core.js`) does the matching. There is no search service to run or pay for.

## Using search

- Press `Ctrl+K` (`Cmd+K` on macOS) or `/` anywhere on the site, or click the search box.
- Type. Results update as you type, in two groups: pages and sections.
- Use `Up` and `Down` to move, `Enter` to open, `Esc` to close.
- Put words in quotes to search for an exact phrase: `"reverse proxy"`.

## What is indexed

For every page the build adds:

- one **page entry**: the title, description and the text before the first heading
- one **section entry** for each `##`, `###` and `####` heading, with the text under it

A section result links straight to its heading, so readers land on the right part of a long page.

Not indexed: fenced code blocks and diagrams, because they are rarely what people search in prose. Inline code inside a sentence is indexed like any other text. Titles of the folders above a page are used as extra context.

## How results are ranked

Every word you type must match somewhere in an entry. Matches in the title count most, then the folder path, then the body.

| Match type | Example for the word "deploy" |
|------------|-------------------------------|
| Exact | `deploy` |
| Start of a word | `deployment` |
| Small typo, for words of 5 or more letters | `deploymnt` |

Exact title matches get a boost, and a page entry gets a small boost over a section entry. At most 6 pages and 8 sections are shown.

Matched words are highlighted in titles and excerpts.

## The index file

`search-index.json` is downloaded the first time a reader opens search, not on every page load. The text is kept as plain text, so the file grows with the amount of prose on your site. As a reference point, a documentation site of this size, around 570 entries, gives a file of roughly 240 KB.

## Limits

- No stemming or synonyms, apart from the start-of-word and typo matching above.
- Text inside fenced code blocks is not searchable.
- The index is rebuilt with the site. Changes to a page appear in search after the next build or publish.
- All the work happens on the reader's device. Very large sites send a large index file.
