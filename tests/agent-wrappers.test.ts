/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const repoRoot = path.resolve(import.meta.dir, "..");
const scriptPath = path.join(
	repoRoot,
	"scripts",
	"generate-agent-wrappers.mjs",
);

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ce-agent-wrappers-"));
	try {
		return await fn(dir);
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
}

async function runWrapperScript(targetDir: string, args: string[] = []) {
	const proc = Bun.spawn(["node", scriptPath, ...args], {
		cwd: repoRoot,
		env: {
			...process.env,
			CE_PI_AGENT_WRAPPER_DIR: targetDir,
		},
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return { exitCode, stdout, stderr };
}

async function readWrapper(targetDir: string, name: string): Promise<string> {
	return fs.readFile(path.join(targetDir, `${name}.md`), "utf8");
}

describe("Compound Engineering global agent wrapper generator", () => {
	test("generates bare aliases for ce-* reviewer agents", async () => {
		await withTempDir(async (targetDir) => {
			const result = await runWrapperScript(targetDir);
			expect(result.exitCode).toBe(0);

			const securityAlias = await readWrapper(targetDir, "security-sentinel");
			const ceSecurity = await readWrapper(targetDir, "ce-security-sentinel");

			expect(securityAlias).toContain("name: security-sentinel");
			expect(securityAlias).not.toContain("name: ce-security-sentinel");
			expect(ceSecurity).toContain("name: ce-security-sentinel");

			for (const alias of [
				"agent-native-reviewer",
				"learnings-researcher",
				"performance-oracle",
				"architecture-strategist",
				"pattern-recognition-specialist",
				"code-simplicity-reviewer",
			]) {
				expect(await readWrapper(targetDir, alias)).toContain(`name: ${alias}`);
			}
		});
	});

	test("check mode detects stale wrappers without rewriting them", async () => {
		await withTempDir(async (targetDir) => {
			expect((await runWrapperScript(targetDir)).exitCode).toBe(0);
			expect((await runWrapperScript(targetDir, ["--check"])).exitCode).toBe(0);

			const stalePath = path.join(targetDir, "security-sentinel.md");
			await fs.writeFile(stalePath, "stale wrapper\n", "utf8");

			const staleCheck = await runWrapperScript(targetDir, ["--check"]);
			expect(staleCheck.exitCode).toBe(1);
			expect(staleCheck.stderr).toContain("wrapper files are stale");
			expect(await fs.readFile(stalePath, "utf8")).toBe("stale wrapper\n");
		});
	});
});
