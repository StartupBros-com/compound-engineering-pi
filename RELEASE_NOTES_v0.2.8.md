# Release notes v0.2.8

## Upstream Compound Engineering 3.11.1 sync

- Refreshed the vendored Compound Engineering plugin snapshot to upstream `3.11.1`.
- Regenerated Pi skills and subagent definitions from the updated upstream resources.
- Added newly available Pi-compatible upstream skills including `ce-polish`, `ce-product-pulse`, `ce-promote`, `ce-riffrec-feedback-analysis`, `ce-simplify-code`, and `ce-strategy`.
- Kept Claude-only `ce-update` out of generated Pi skills because upstream marks it `ce_platforms: [claude]`.

## Pi fork preservation

- Updated the upstream sync script to preserve Pi-owned reviewer agents in addition to Pi-owned compatibility skills.
- Preserved Pi-specific agent additions such as CLI readiness, DHH/Rails, Kieran language reviewers, and schema drift detection.
- Updated tests for upstream's agent filename change from `.agent.md` to `.md`.

No npm publish is implied by these notes; publish still requires an explicit release decision.
