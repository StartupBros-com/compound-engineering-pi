import crypto from "node:crypto"
import fs from "node:fs"
import { promises as fsp } from "node:fs"
import os from "node:os"
import path from "node:path"

export const DEFAULT_MCPB_INSTALL_ROOT = path.join(os.homedir(), ".pi", "agent", "mcpb")
export const DEFAULT_MCPORTER_CONFIG_PATH = path.join(os.homedir(), ".pi", "agent", "compound-engineering", "mcporter.json")

export type McpbUserConfigField = {
  type?: string
  title?: string
  description?: string
  sensitive?: boolean
  required?: boolean
  default?: unknown
  multiple?: boolean
  [key: string]: unknown
}

export type McpbManifest = {
  manifest_version?: string
  name?: string
  display_name?: string
  version?: string
  description?: string
  author?: { name?: string; [key: string]: unknown }
  server?: {
    type?: string
    entry_point?: string
    mcp_config?: {
      command?: string
      args?: unknown[]
      env?: Record<string, unknown>
      cwd?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  tools?: Array<{ name?: string; description?: string; [key: string]: unknown }>
  prompts?: Array<{ name?: string; description?: string; [key: string]: unknown }>
  tools_generated?: boolean
  prompts_generated?: boolean
  compatibility?: { platforms?: string[]; [key: string]: unknown }
  user_config?: Record<string, McpbUserConfigField>
  [key: string]: unknown
}

export type McporterServerEntry = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  baseUrl?: string
  url?: string
  description?: string
  disabled?: boolean
  [key: string]: unknown
}

export type McporterConfig = {
  mcpServers?: Record<string, McporterServerEntry>
  [key: string]: unknown
}

export type ResolvedUserConfig = {
  values: Record<string, unknown>
  sensitiveKeys: string[]
  missingRequired: string[]
  warnings: string[]
}

export type BuildMcporterEntryResult = {
  entry: McporterServerEntry
  warnings: string[]
  sensitiveEnvKeys: string[]
  sensitiveArgIndices: number[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function normalizePathArgument(baseCwd: string, input: string): string {
  const trimmed = String(input || "").trim().replace(/^@/, "")
  if (!trimmed) throw new Error("Path is required")

  const expanded = trimmed === "~"
    ? os.homedir()
    : trimmed.startsWith("~/")
      ? path.join(os.homedir(), trimmed.slice(2))
      : trimmed

  return path.resolve(baseCwd, expanded)
}

export function safeSlug(value: string): string {
  return String(value || "mcpb")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "mcpb"
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256")
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve())
  })
  return hash.digest("hex")
}

export async function sha256Directory(directory: string): Promise<string> {
  const root = path.resolve(directory)
  const hash = crypto.createHash("sha256")

  async function walk(current: string): Promise<void> {
    const entries = await fsp.readdir(current, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      const relative = path.relative(root, fullPath).replace(/\\/g, "/")
      const stat = await fsp.lstat(fullPath)
      if (stat.isSymbolicLink()) throw new Error("MCPB directory contains a symlink, which is not allowed: " + fullPath)

      if (stat.isDirectory()) {
        hash.update("dir\0" + relative + "\0")
        await walk(fullPath)
      } else if (stat.isFile()) {
        hash.update("file\0" + relative + "\0")
        hash.update(await fsp.readFile(fullPath))
        hash.update("\0")
      }
    }
  }

  await walk(root)
  return hash.digest("hex")
}

export function sha256Text(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function parseMcpbManifest(raw: string): McpbManifest {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) throw new Error("manifest.json must contain a JSON object")
  return parsed as McpbManifest
}

export async function readManifestFromDirectory(directory: string): Promise<McpbManifest> {
  return parseMcpbManifest(await fsp.readFile(path.join(directory, "manifest.json"), "utf8"))
}

export function validateMcpbManifest(manifest: McpbManifest): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!manifest.manifest_version || typeof manifest.manifest_version !== "string") {
    errors.push("manifest_version must be present and be a string")
  }
  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push("name must be present and be a string")
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    errors.push("version must be present and be a string")
  }
  if (!manifest.description || typeof manifest.description !== "string") {
    warnings.push("description is missing; MCPB hosts generally expect it for safe discovery")
  }
  if (!isRecord(manifest.author) || typeof manifest.author.name !== "string") {
    warnings.push("author.name is missing; MCPB hosts generally expect it for provenance")
  }
  if (!isRecord(manifest.server)) {
    errors.push("server must be present and be an object")
    return { errors, warnings }
  }

  const serverType = typeof manifest.server.type === "string" ? manifest.server.type : ""
  if (!serverType) {
    warnings.push("server.type is missing; supported values are node, python, uv, and binary")
  } else if (!["node", "python", "uv", "binary"].includes(serverType)) {
    warnings.push("server.type '" + serverType + "' is not one of node, python, uv, or binary")
  }

  const mcpConfig = manifest.server.mcp_config
  if (mcpConfig !== undefined && !isRecord(mcpConfig)) {
    errors.push("server.mcp_config must be an object when present")
  }

  if (isRecord(mcpConfig)) {
    if (mcpConfig.command !== undefined && typeof mcpConfig.command !== "string") {
      errors.push("server.mcp_config.command must be a string when present")
    }
    if (mcpConfig.args !== undefined && !Array.isArray(mcpConfig.args)) {
      errors.push("server.mcp_config.args must be an array when present")
    }
    if (mcpConfig.env !== undefined && !isRecord(mcpConfig.env)) {
      errors.push("server.mcp_config.env must be an object when present")
    }
  }

  if (!isRecord(mcpConfig) || !mcpConfig.command) {
    if (typeof manifest.server.entry_point !== "string" || !manifest.server.entry_point.trim()) {
      errors.push("server.entry_point is required when server.mcp_config.command is absent")
    } else if (!serverType || !["node", "python", "uv", "binary"].includes(serverType)) {
      errors.push("server.type must be node, python, uv, or binary to derive a MCPorter command")
    }
  }

  const platforms = manifest.compatibility?.platforms
  if (Array.isArray(platforms) && platforms.length > 0 && !platforms.includes(process.platform)) {
    warnings.push("compatibility.platforms does not include this platform ('" + process.platform + "')")
  }

  return { errors, warnings }
}

export function assertSafeZipEntries(entries: string[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  let hasManifest = false

  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, "/")
    const parts = normalized.split("/").filter(Boolean)
    if (!normalized || normalized.endsWith("/")) continue
    if (normalized === "manifest.json") hasManifest = true
    if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
      errors.push("Zip entry uses an absolute path: " + entry)
    }
    if (parts.includes("..")) {
      errors.push("Zip entry attempts directory traversal: " + entry)
    }
    if (entry.includes("\0")) {
      errors.push("Zip entry contains a NUL byte: " + entry)
    }
  }

  if (!hasManifest) errors.push("Bundle does not contain manifest.json at the archive root")
  if (entries.length > 5000) warnings.push("Bundle contains more than 5000 entries; inspect carefully before importing")

  return { errors: Array.from(new Set(errors)), warnings }
}

function expandHomeLiteral(value: string): string {
  return value.replace(/\$\{HOME\}/g, os.homedir())
}

function expandDefaultValue(value: unknown): unknown {
  if (typeof value === "string") return expandHomeLiteral(value)
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? expandHomeLiteral(item) : item)
  return value
}

export function resolveUserConfig(manifest: McpbManifest, provided: Record<string, unknown> = {}): ResolvedUserConfig {
  const fields = manifest.user_config ?? {}
  const values: Record<string, unknown> = {}
  const sensitiveKeys: string[] = []
  const missingRequired: string[] = []
  const warnings: string[] = []

  for (const [key, field] of Object.entries(fields)) {
    if (field.sensitive) sensitiveKeys.push(key)

    if (Object.prototype.hasOwnProperty.call(provided, key)) {
      values[key] = provided[key]
      continue
    }

    if (Object.prototype.hasOwnProperty.call(field, "default")) {
      values[key] = expandDefaultValue(field.default)
      continue
    }

    if (field.required) {
      missingRequired.push(key)
    }
  }

  for (const key of Object.keys(provided)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      warnings.push("userConfig contains key '" + key + "' that is not declared by manifest.user_config")
      values[key] = provided[key]
    }
  }

  return { values, sensitiveKeys, missingRequired, warnings }
}

function formatUserConfigValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatUserConfigValue).join(path.delimiter)
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function substituteTemplate(value: string, installDir: string, userConfig: Record<string, unknown>): string {
  let output = value.replace(/\$\{__dirname\}/g, installDir).replace(/\$\{HOME\}/g, os.homedir())
  output = output.replace(/\$\{user_config\.([A-Za-z0-9_.-]+)\}/g, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(userConfig, key)) return ""
    return formatUserConfigValue(userConfig[key])
  })
  return output
}

function resolveMaybeRelativeCommand(command: string, installDir: string): string {
  const normalized = command.replace(/\\/g, "/")
  const looksLikePath = normalized.startsWith(".") || normalized.includes("/")
  if (!looksLikePath || path.isAbsolute(command)) return command
  return path.resolve(installDir, command)
}

function hasSensitivePlaceholder(value: unknown, sensitiveKeys: string[]): boolean {
  if (typeof value !== "string") return false
  return sensitiveKeys.some((key) => value.includes("${user_config." + key + "}"))
}

function looksSecretEnvName(key: string): boolean {
  return /(TOKEN|SECRET|PASSWORD|PASS|API[_-]?KEY|PRIVATE|CREDENTIAL)/i.test(key)
}

function stringifyArgs(args: unknown[] | undefined, installDir: string, userConfig: Record<string, unknown>): string[] {
  return (args ?? []).map((arg) => substituteTemplate(formatUserConfigValue(arg), installDir, userConfig))
}

function findSensitiveArgIndices(args: unknown[] | undefined, sensitiveKeys: string[]): number[] {
  return (args ?? [])
    .map((arg, index) => hasSensitivePlaceholder(arg, sensitiveKeys) ? index : -1)
    .filter((index) => index >= 0)
}

export function buildMcporterServerEntry(
  manifest: McpbManifest,
  installDir: string,
  resolvedUserConfig: ResolvedUserConfig,
): BuildMcporterEntryResult {
  const warnings: string[] = []
  const sensitiveEnvKeys: string[] = []
  let sensitiveArgIndices: number[] = []
  const server = manifest.server
  if (!server) throw new Error("Manifest is missing server")

  const userConfig = resolvedUserConfig.values
  const mcpConfig = server.mcp_config
  const entry: McporterServerEntry = {}

  if (mcpConfig?.command) {
    const command = substituteTemplate(mcpConfig.command, installDir, userConfig)
    entry.command = resolveMaybeRelativeCommand(command, installDir)
    entry.args = stringifyArgs(mcpConfig.args, installDir, userConfig)
    sensitiveArgIndices = findSensitiveArgIndices(mcpConfig.args, resolvedUserConfig.sensitiveKeys)
    entry.cwd = mcpConfig.cwd ? substituteTemplate(mcpConfig.cwd, installDir, userConfig) : installDir

    if (mcpConfig.env) {
      entry.env = {}
      for (const [key, rawValue] of Object.entries(mcpConfig.env)) {
        entry.env[key] = substituteTemplate(formatUserConfigValue(rawValue), installDir, userConfig)
        if (hasSensitivePlaceholder(rawValue, resolvedUserConfig.sensitiveKeys) || looksSecretEnvName(key)) {
          sensitiveEnvKeys.push(key)
        }
      }
    }
  } else {
    const entryPoint = server.entry_point
    const serverType = server.type
    if (!entryPoint || !serverType) throw new Error("Cannot derive MCPorter entry without server.type and server.entry_point")

    const absoluteEntryPoint = path.resolve(installDir, entryPoint)
    entry.cwd = installDir

    if (serverType === "node") {
      entry.command = "node"
      entry.args = [absoluteEntryPoint]
    } else if (serverType === "python") {
      entry.command = "python"
      entry.args = [absoluteEntryPoint]
    } else if (serverType === "uv") {
      entry.command = "uv"
      entry.args = ["run", "--directory", installDir, "python", absoluteEntryPoint]
      warnings.push("Derived a best-effort uv command because server.mcp_config was absent; verify with mcporter_list before relying on it")
    } else if (serverType === "binary") {
      entry.command = absoluteEntryPoint
      entry.args = []
    } else {
      throw new Error("Unsupported server.type: " + serverType)
    }
  }

  if (manifest.description) entry.description = manifest.description

  return {
    entry,
    warnings,
    sensitiveEnvKeys: Array.from(new Set(sensitiveEnvKeys)),
    sensitiveArgIndices: Array.from(new Set(sensitiveArgIndices)),
  }
}

export function maskMcporterEntry(
  entry: McporterServerEntry,
  sensitiveEnvKeys: string[] = [],
  sensitiveArgIndices: number[] = [],
): McporterServerEntry {
  const masked: McporterServerEntry = { ...entry }
  if (entry.args) {
    const sensitiveArgs = new Set(sensitiveArgIndices)
    masked.args = entry.args.map((arg, index) => sensitiveArgs.has(index) ? "***" : arg)
  }
  if (entry.env) {
    const sensitive = new Set(sensitiveEnvKeys)
    masked.env = {}
    for (const [key, value] of Object.entries(entry.env)) {
      masked.env[key] = sensitive.has(key) || looksSecretEnvName(key) ? "***" : value
    }
  }
  return masked
}

export function defaultServerName(manifest: McpbManifest, explicit?: string): string {
  return safeSlug(explicit || manifest.name || manifest.display_name || "mcpb-server")
}

export function defaultInstallDir(manifest: McpbManifest, hash: string, installRoot = DEFAULT_MCPB_INSTALL_ROOT): string {
  const name = safeSlug(manifest.name || manifest.display_name || "mcpb")
  const version = safeSlug(manifest.version || "0.0.0")
  return path.join(installRoot, name + "-" + version + "-" + hash.slice(0, 12))
}

export async function readMcporterConfig(configPath: string): Promise<McporterConfig> {
  try {
    const raw = await fsp.readFile(configPath, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) throw new Error("MCPorter config must be a JSON object")
    const config = parsed as McporterConfig
    if (config.mcpServers !== undefined && !isRecord(config.mcpServers)) {
      throw new Error("MCPorter config mcpServers must be an object")
    }
    return config
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { mcpServers: {} }
    throw error
  }
}

export function mergeMcporterServer(
  config: McporterConfig,
  serverName: string,
  entry: McporterServerEntry,
  overwrite = false,
): { config: McporterConfig; changed: boolean; existed: boolean } {
  const next: McporterConfig = { ...config, mcpServers: { ...(config.mcpServers ?? {}) } }
  const existed = Object.prototype.hasOwnProperty.call(next.mcpServers, serverName)
  if (existed && !overwrite) return { config: next, changed: false, existed }
  next.mcpServers![serverName] = entry
  return { config: next, changed: true, existed }
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = path.join(path.dirname(filePath), "." + path.basename(filePath) + ".tmp-" + process.pid + "-" + Date.now())
  await fsp.writeFile(tempPath, JSON.stringify(value, null, 2) + "\n", "utf8")
  await fsp.rename(tempPath, filePath)
}

export async function assertNoSymlinks(root: string): Promise<void> {
  const entries = await fsp.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    const stat = await fsp.lstat(fullPath)
    if (stat.isSymbolicLink()) throw new Error("Imported bundle contains a symlink, which is not allowed: " + fullPath)
    if (stat.isDirectory()) await assertNoSymlinks(fullPath)
  }
}

export function ensurePathInside(parent: string, child: string): void {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to operate outside " + parent + ": " + child)
  }
}

export function summarizeMcpbManifest(manifest: McpbManifest): Record<string, unknown> {
  return {
    name: manifest.name,
    displayName: manifest.display_name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author?.name,
    manifestVersion: manifest.manifest_version,
    serverType: manifest.server?.type,
    entryPoint: manifest.server?.entry_point,
    hasMcpConfig: Boolean(manifest.server?.mcp_config),
    userConfig: Object.entries(manifest.user_config ?? {}).map(([key, field]) => ({
      key,
      type: field.type,
      required: Boolean(field.required),
      sensitive: Boolean(field.sensitive),
      hasDefault: Object.prototype.hasOwnProperty.call(field, "default"),
      title: field.title,
      description: field.description,
    })),
    tools: (manifest.tools ?? []).map((tool) => ({ name: tool.name, description: tool.description })),
    toolsGenerated: Boolean(manifest.tools_generated),
    prompts: (manifest.prompts ?? []).map((prompt) => ({ name: prompt.name, description: prompt.description })),
    promptsGenerated: Boolean(manifest.prompts_generated),
    compatibility: manifest.compatibility,
  }
}
