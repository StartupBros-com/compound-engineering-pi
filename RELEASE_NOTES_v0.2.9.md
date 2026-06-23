# Release notes v0.2.9

## Upstream Compound Engineering 3.13.1 sync

- Refreshed the vendored Compound Engineering plugin snapshot to upstream
  `3.13.1`.
- Regenerated Pi skills from the current upstream agentless skill surface.
- Removed stale generated standalone CE agents that upstream no longer ships;
  preserved Pi-owned compatibility agents.
- Bundled the current upstream plugin metadata, docs, and native target assets
  used by cross-target conversion.

## Pi compatibility

- Updated upstream sync to resolve the modern repository-root plugin layout
  (`.claude-plugin/plugin.json`) instead of the removed
  `plugins/compound-engineering` source path.
- Kept Pi-specific target wiring and compatibility transforms intact while
  syncing upstream converter behavior.
- Removed stale bundled MCPorter config when upstream emits no generated MCP
  servers.

No npm publish is implied by these notes; publish still requires an explicit
release decision.
