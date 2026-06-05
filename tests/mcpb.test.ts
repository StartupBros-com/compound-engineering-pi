import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import {
  assertSafeZipEntries,
  buildMcporterServerEntry,
  defaultInstallDir,
  defaultServerName,
  maskMcporterEntry,
  mergeMcporterServer,
  resolveUserConfig,
  validateMcpbManifest,
  type McpbManifest,
} from "../src/mcpb"

describe("mcpb helpers", () => {
  test("rejects unsafe archive paths", () => {
    const result = assertSafeZipEntries([
      "manifest.json",
      "server/index.js",
      "../escape.txt",
      "/absolute.txt",
      "nested/../../escape-again.txt",
    ])

    expect(result.errors).toContain("Zip entry attempts directory traversal: ../escape.txt")
    expect(result.errors).toContain("Zip entry uses an absolute path: /absolute.txt")
    expect(result.errors).toContain("Zip entry attempts directory traversal: nested/../../escape-again.txt")
  })

  test("builds a masked MCPorter entry from mcp_config and user_config", () => {
    const manifest: McpbManifest = {
      manifest_version: "0.4",
      name: "local-files",
      version: "0.1.0",
      description: "Local files MCP server",
      author: { name: "Example" },
      server: {
        type: "node",
        entry_point: "server/index.js",
        mcp_config: {
          command: "node",
          args: ["${__dirname}/server/index.js", "--root", "${user_config.rootDir}", "--api-key", "${user_config.apiKey}"],
          env: {
            API_KEY: "${user_config.apiKey}",
            MODE: "read-only",
          },
        },
      },
      user_config: {
        rootDir: { type: "directory", required: true },
        apiKey: { type: "string", required: true, sensitive: true },
      },
    }

    const resolved = resolveUserConfig(manifest, { rootDir: "/tmp/project", apiKey: "secret-value" })
    const built = buildMcporterServerEntry(manifest, "/tmp/mcpb/local-files", resolved)

    expect(built.entry).toMatchObject({
      command: "node",
      args: ["/tmp/mcpb/local-files/server/index.js", "--root", "/tmp/project", "--api-key", "secret-value"],
      cwd: "/tmp/mcpb/local-files",
      env: { API_KEY: "secret-value", MODE: "read-only" },
      description: "Local files MCP server",
    })
    const masked = maskMcporterEntry(built.entry, built.sensitiveEnvKeys, built.sensitiveArgIndices)
    expect(masked.env?.API_KEY).toBe("***")
    expect(masked.args?.at(-1)).toBe("***")
  })

  test("reports missing required user_config values", () => {
    const manifest: McpbManifest = {
      manifest_version: "0.4",
      name: "needs-config",
      version: "1.0.0",
      server: { type: "node", entry_point: "server/index.js" },
      user_config: {
        token: { type: "string", required: true, sensitive: true },
      },
    }

    const validation = validateMcpbManifest(manifest)
    const resolved = resolveUserConfig(manifest, {})

    expect(validation.errors).toEqual([])
    expect(resolved.missingRequired).toEqual(["token"])
    expect(resolved.sensitiveKeys).toEqual(["token"])
  })

  test("derives stable names and install directories", () => {
    const manifest: McpbManifest = {
      manifest_version: "0.4",
      name: "My Cool MCP!",
      version: "1.2.3",
      server: { type: "binary", entry_point: "server/tool" },
    }

    expect(defaultServerName(manifest)).toBe("my-cool-mcp")
    expect(defaultInstallDir(manifest, "abcdef0123456789", path.join(os.tmpdir(), "mcpb-root"))).toBe(
      path.join(os.tmpdir(), "mcpb-root", "my-cool-mcp-1.2.3-abcdef012345"),
    )
  })

  test("refuses to overwrite existing MCPorter entries unless requested", () => {
    const existing = { mcpServers: { demo: { command: "old" } } }
    const refused = mergeMcporterServer(existing, "demo", { command: "new" }, false)
    const overwritten = mergeMcporterServer(existing, "demo", { command: "new" }, true)

    expect(refused.changed).toBe(false)
    expect(refused.existed).toBe(true)
    expect(refused.config.mcpServers?.demo.command).toBe("old")
    expect(overwritten.changed).toBe(true)
    expect(overwritten.config.mcpServers?.demo.command).toBe("new")
  })
})
