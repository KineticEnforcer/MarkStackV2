---
title: Automated Builds
description: Run MarkStack's tests and build in CI, and publish the result with a workflow.
---

# Automated Builds

Because a build is one command that exits with an error when something is wrong, it fits well in CI. A broken page, bad frontmatter or a duplicate URL fails the job before it reaches readers.

## A basic workflow

This is the shape MarkStack's own workflow uses, as a GitHub Actions file. It installs exact versions from the lockfile, runs the tests, builds the site and checks dependencies for known high severity problems.

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm audit --audit-level=high
```

Check the current action versions on the Marketplace when you copy this. Any CI system works the same way: install Node.js 24, then run the same four commands.

## Keep the output

To use the built site in a later step, upload `dist/` as an artifact or copy it to your host.

```yaml
      - uses: actions/upload-artifact@v7
        with:
          name: site
          path: dist
```

How you push `dist/` to a host depends on the host. Many static hosts can run `npm run build` themselves from your repository, which needs no CI upload step at all. See [Deployment Guide](/build-and-deploy/deployment-guide/).

## Useful checks

- Build with `--out` into a temporary folder when you only want to know whether the build passes.
- Keep `package-lock.json` in Git and use `npm ci`, so builds are repeatable.
- A build ends with a non-zero code on invalid YAML frontmatter and duplicate URLs, so no extra step is needed to catch them.
- The build does not check that links point to real pages. Add a link checker over `dist/` if broken links matter to you.

## Content only workflows

If most changes are Markdown, limit the workflow to the paths that affect the site, so unrelated commits do not run it:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'content/**'
      - 'static/**'
      - 'templates/**'
      - 'siteconfig.json'
```
