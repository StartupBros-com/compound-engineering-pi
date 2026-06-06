# Compound Engineering for Pi

This guide explains how to use the Compound Engineering plugin in **Pi** with the new `--to pi` target.

## TL;DR

### Fast path (just works)

```bash
# 1) Install as a Pi package
# after npm publish:
pi install npm:compound-engineering-pi
# fallback (works now):
pi install git:github.com/StartupBros/compound-engineering-pi@v0.2.8

# 2) Install MCPorter (for MCP-style tool access in Pi)
npm i -g mcporter

# 3) Reload Pi resources
/reload
```

### Converter path (advanced/custom)

Prefer the upstream converter package:

```bash
bunx @every-env/compound-plugin install compound-engineering --to pi
```

The local `compound-engineering-pi` CLI remains available for compatibility, but upstream is the canonical place for converter behavior.

You will get generated resources under your Pi directory:

- `prompts/` (converted slash commands, when present)
- `skills/` (plugin skills)
- `agents/` (generated Pi subagent definitions)
- `extensions/compound-engineering-compat.ts` (compat tools, in this package)
- `compound-engineering/mcporter.json` (MCPorter server config, when upstream defines MCP servers)

The published package already includes prebuilt `extensions/`, `skills/`, `agents/`, and compatibility `prompts/` for Pi package installs.

This repo now tracks upstream Compound Engineering 3.11.1 while keeping the older `/workflows-*` prompts as Pi-friendly compatibility aliases.

For package installs, `mcporter_list`/`mcporter_call` use a generated project/global MCPorter config when upstream defines MCP servers. The package does not ship a stale default MCP server config.

---

## Why this exists

Claude Code plugins are not directly runnable in Pi.

The `pi` target translates Claude plugin concepts into native Pi resources so teams can keep the same compounding workflow:

**Plan → Work → Review → Compound**

---

## Concept mapping (easy to explain)

| Claude concept | Pi equivalent |
|---|---|
| `commands/*.md` | `.pi/prompts/*.md` |
| `skills/*/SKILL.md` | `.pi/skills/*/SKILL.md` |
| `agents/*.md` | generated Pi subagent files in `.pi/agents/*.md` / this repo's `agents/*.md` |
| `Task agent(args)` | `subagent` tool call (generated compat extension) |
| `AskUserQuestion` | `ask_user_question` tool |
| MCP server config | MCPorter config in `.pi/compound-engineering/mcporter.json` |

---

## Generated Pi compatibility tools

The generated extension provides these tools:

### `ask_user_question`
Interactive question/choice tool for workflows that need explicit user decisions.
Supports single-select and multi-select questions via an optional `multiSelect: true` flag, while preserving the simpler `question` / `options` / `allowCustom` shape.

### `subagent`
Runs skill-based subagents through nested Pi sessions.

Supports:
- **single**: `{ agent, task }`
- **parallel**: `{ tasks: [...] }`
- **chain**: `{ chain: [...] }` with `{previous}` placeholder support

Behavior notes:
- **single mode returns the full subagent output** in the final tool result
- **chain mode returns the final step output** plus a step summary
- **parallel mode returns a compact summary by default**; pass `includeOutputs: true` to include full output for each completed subagent
- if you install a richer `pi-subagents` package, this compatibility extension will automatically step aside and let that tool handle subagents instead

### `mcporter_list`
Lists tools for an MCP server via MCPorter.

### `mcporter_call`
Calls a specific MCP tool via MCPorter.

### `mcpb_inspect`
Inspects a `.mcpb` bundle or unpacked MCPB directory without installing or running it. Reports manifest metadata, declared tools, required `user_config`, sensitive config fields, archive safety warnings, and validation errors.

### `mcpb_import`
Imports a `.mcpb` bundle into a quarantined local install directory and writes a MCPorter server entry.

Defaults:
- install root: `~/.pi/agent/mcpb/`
- config target: project-local `.pi/compound-engineering/mcporter.json`
- no automatic server probe/run after import

Use `dryRun: true` to preview the masked MCPorter entry. Use `target: "global"` to write `~/.pi/agent/compound-engineering/mcporter.json`.

### `mcpb_export`
Validates or packs an unpacked MCPB directory using the `mcpb` CLI when available. If the CLI is not installed, install `@anthropic-ai/mcpb` or pass `useNpx: true` for a one-off run.

---

## MCP via MCPorter and MCPB

Pi itself does not include native MCP runtime behavior identical to Claude Code. This target uses MCPorter as the runtime compatibility layer.

MCPB (`.mcpb`) support is packaging-oriented: inspect/import/export tools translate local MCP bundles into MCPorter config instead of replacing MCPorter.

Generated config path:

- Project: `.pi/compound-engineering/mcporter.json`
- Global: `~/.pi/agent/compound-engineering/mcporter.json`

You can extend this file with your own server definitions and auth headers as needed.

---

## Sync your personal Claude setup into Pi

```bash
bunx compound-engineering-pi sync --target pi
```

This syncs:
- personal skills from `~/.claude/skills` (symlinked)
- MCP servers from `~/.claude/settings.json` into Pi MCPorter config

---

## Keeping this package synced with upstream

```bash
bun run sync:upstream
```

By default this pulls from `~/.cache/checkouts/github.com/EveryInc/compound-engineering-plugin` when available, falls back to `../compound-engineering-plugin`, refreshes the vendored `plugins/compound-engineering` snapshot, and regenerates bundled Pi skills/agents/MCPorter config.

Maintainer rule: changes to conversion behavior, plugin content, or target semantics should be made upstream first. This repo is the Pi distribution layer.

## Recommended OSS adoption flow

1. Start with side-by-side generation:
   ```bash
   bunx compound-engineering-pi install compound-engineering --to opencode --also pi
   ```
2. Validate one real workflow (`/workflows-plan` + review loop).
3. Keep generated resources in version control for team reproducibility.
4. Add project-specific skills gradually (don’t fork everything at once).
5. Publish your own package presets once stable.

---

## Troubleshooting

### `mcporter` not found
Install globally:

```bash
npm i -g mcporter
```

### Prompts/skills not visible in Pi
Run:

```bash
/reload
```

### Subagent calls fail
Check:
- target agent exists in `.pi/agents/<name>.md` or `~/.pi/agent/agents/<name>.md`
- for local dogfooding, run `npm run agents:generate` from this repo and verify with `npm run agents:check`
- review aliases such as `security-sentinel`, `performance-oracle`, `agent-native-reviewer`, and `learnings-researcher` exist when using the Pi-native review runtime
- target skill exists in `.pi/skills/<name>/SKILL.md` when using a skill wrapper
- nested Pi call works: `pi --no-session -p "/skill:<name> ..."`
- permissions/sandbox rules in your environment

### I want to see more subagent output
- single subagents now return their full output in the tool result
- chain runs return the final step output plus a step summary
- parallel runs can return all outputs with `includeOutputs: true`
- if you prefer a richer live subagent UI, install `pi-subagents`; `compound-engineering-pi` will automatically defer to it when present

---

## One-paragraph explanation for others

> We added a `--to pi` converter target that ports Compound Engineering Claude plugins into native Pi resources (skills, subagent definitions, prompts, extension tools). Claude-only behaviors like `Task(...)` and `AskUserQuestion` are mapped to Pi compatibility tools (`subagent`, `ask_user_question`), and MCP integrations are handled through MCPorter config instead of native MCP runtime assumptions. This keeps the same compounding workflow in Pi while making it easy for open-source teams to share a reproducible setup.
