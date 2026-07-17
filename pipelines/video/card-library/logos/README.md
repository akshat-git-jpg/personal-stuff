# Logos Registry

This directory contains tool logos for cards.

## Fetching a logo
To fetch a logo from Google's favicon service, run:
`node scripts/fetch-logo.mjs <slug> <domain>`

Note that slugs should be lowercase alphanumeric tool names.

## Manual overrides
If the fetched favicon is ugly, you can replace the PNG by hand and update `registry.json` to have `"source": "manual"` for that slug. The fetch script will refuse to overwrite it.
