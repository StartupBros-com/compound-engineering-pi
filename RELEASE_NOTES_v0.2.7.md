# Release notes v0.2.7

## MCPB compatibility layer

- Added `mcpb_inspect` to inspect `.mcpb` archives or unpacked MCPB directories without installing or running them.
- Added `mcpb_import` to safely unpack MCPB bundles into `~/.pi/agent/mcpb/` and write MCPorter server entries.
- Added `mcpb_export` to validate or pack unpacked MCPB directories when the MCPB CLI is available.
- Added archive path-traversal checks, symlink rejection after extraction, masked secret output, and overwrite-safe MCPorter config merging.

## Notes

MCPB support is packaging-oriented. MCPorter remains the runtime bridge for listing and calling MCP tools from Pi.
