# Upstream relationship

- **Upstream:** https://github.com/gvkhosla/compound-engineering-pi
- **Divergence (as of 2026-07-24):** +20 ahead / -0 behind upstream default branch
- **Fork type:** Contribution/maintenance fork
- **Sync cadence:** Documented sync-from-upstream on each CE release.

## StartupBros-specific delta

Compound-engineering workflow extension for Pi, loaded live. Repeatable upstream-sync process plus Pi-specific fixes (session-native handoffs, native question tool).

## Why this file exists

An org-wide audit on 2026-07-24 found that comparing only the *default* branch made
several forks look like zero-delta mirrors when they actually carried unmerged
StartupBros fixes on side branches. Any future fork-pruning pass must enumerate and
author-check **all** branches, not just default-branch ahead/behind.
