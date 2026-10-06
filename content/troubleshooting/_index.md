---
title: Troubleshooting
description: Fix common MarkStack problems with builds, pages, styles, search, deployment and the editor, and find answers to common questions.
---

# Troubleshooting

| Page | Use it when |
|------|-------------|
| [Common Issues](/troubleshooting/common-issues/) | Something fails or looks wrong |
| [Frequently Asked Questions](/troubleshooting/frequently-asked-questions/) | You want to know what MarkStack can and cannot do |

## First steps for any problem

1. Read the last lines of the build output. Errors name the file and often the line.
2. Run `npm test` to check that the installation itself is sound.
3. Build a copy with `--out` into a temporary folder to see whether the build or the hosting is at fault.
4. Check for `node --version` 24 or newer.

If you use the editor and a publish fails, the dialog shows the stage, the error and a **Copy diagnostics** button. See [Publishing](/editing-and-admin/publishing/).
