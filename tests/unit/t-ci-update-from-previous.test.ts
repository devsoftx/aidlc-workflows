// covers: file:scripts/ci-update-from-previous.ts
// The update-from-the-last-release check finds each harness tree's hook
// commands, installed or copied, and reads the hook phase trace to see that
// the engine ran them. It passes each release's config the Kiro names that
// release reads, and updates from the newest stable release older than the
// candidate: the fork's own, else upstream's before the fork has one.
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { gitBashPath, gitBashSkipReason } from "../harness/git-bash.ts";
import { NATIVE_COMPILE_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import {
  bareAidlcProblem,
  checksumMatches,
  childEnvironment,
  copyRuntimeAsset,
  dispatched,
  findPrevious,
  harnessArgFor,
  hookCommands,
  hookInput,
  hookRuns,
  hooksTracedToCompletion,
  opencodeHookCommands,
  previousRelease,
  previousReleaseRepository,
  tracedToCompletion,
  uncheckedHarnesses,
  UPSTREAM_REPOSITORY,
} from "../../scripts/ci-update-from-previous.ts";
import kiroManifest from "../../harness/kiro/manifest.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), "aidlc-update-from-previous-"));
  roots.push(root);
  return root;
}

function trace(dir: string, ...phases: object[]): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "hook-1.ndjson"), phases.map((phase) => JSON.stringify(phase)).join("\n") + "\n");
  return dir;
}

describe("ci-update-from-previous helpers", () => {
  test("hook commands come from every JSON config in the tree, nested or not", () => {
    const tree = scratch();
    mkdirSync(join(tree, "hooks"), { recursive: true });
    writeFileSync(join(tree, "settings.json"), JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: "command", command: "aidlc engine hook continue-workflow" }] }] },
      statusLine: { command: "aidlc engine statusline" },
    }));
    // A Kiro IDE hook file, written as text: its "then" key is the hook's action.
    writeFileSync(join(tree, "hooks", "guard.kiro.hook"),
      '{"then":{"command":"aidlc engine adapter kiro state-transition-guard aidlc-developer-agent"},' +
        '"when":{"patterns":["aidlc engine adapter *"]}}');
    writeFileSync(join(tree, "hooks", "notes.md"), "aidlc engine hook session-start\n");
    writeFileSync(join(tree, "broken.json"), "{ not json");
    expect(hookCommands(tree)).toEqual([
      "aidlc engine adapter kiro state-transition-guard aidlc-developer-agent",
      "aidlc engine hook continue-workflow",
    ]);
    expect(hookCommands(join(tree, "missing"))).toEqual([]);
  });

  test("opencode's hook commands come from its plugin, in the form the plugin starts them", () => {
    const tree = scratch();
    const plugin = join(tree, "aidlc-opencode-adapter.ts");
    writeFileSync(plugin, [
      'const PROJECTED_INVOKE = "aidlc";',
      'const TRUSTED_NAMESPACE = "engine";',
      "// chat.message -> aidlc-session-start.ts",
      'await runCore("aidlc-write-audit-log.ts", payload, directory);',
      "const result = await runCore(",
      '  "aidlc-session-start.ts",',
      "  input,",
      ");",
      'const message = "use aidlc-orchestrate.ts report instead";',
    ].join("\n"));
    expect(opencodeHookCommands(plugin)).toEqual([
      "aidlc engine hook session-start",
      "aidlc engine hook write-audit-log",
    ]);
    // A source tree that was never projected falls back the way the plugin does.
    writeFileSync(plugin, 'const PROJECTED_INVOKE = "{{INVOKE}}";\n  "aidlc-session-start.ts",\n');
    expect(opencodeHookCommands(plugin)).toEqual(["bun .aidlc/tools/aidlc.ts engine hook session-start"]);
    expect(opencodeHookCommands(join(tree, "missing.ts"))).toEqual([]);
  });

  // The shell gets the project folder on opencode's hook commands, as the
  // plugin passes it; whether the phase trace must show a hook is read from the
  // command the plugin names, so opencode's hooks are held to it too.
  test("opencode's hooks are held to the phase trace, though their command carries the project folder", () => {
    const project = scratch();
    mkdirSync(join(project, ".opencode", "plugin"), { recursive: true });
    writeFileSync(join(project, ".opencode", "plugin", "aidlc-opencode-adapter.ts"), [
      'const PROJECTED_INVOKE = "bun .aidlc/tools/aidlc.ts";',
      'const TRUSTED_NAMESPACE = "engine";',
      'await runCore("aidlc-session-start.ts", payload, directory);',
    ].join("\n"));
    expect(hookRuns("opencode", project)).toEqual([
      { command: 'bun .aidlc/tools/aidlc.ts engine hook session-start --project-dir "$CLAUDE_PROJECT_DIR"', traced: true },
    ]);
    mkdirSync(join(project, ".github", "hooks"), { recursive: true });
    writeFileSync(join(project, ".github", "hooks", "aidlc.json"), JSON.stringify({
      hooks: { preToolUse: [{ bash: "bun .aidlc/hooks/aidlc-copilot-adapter.ts guard-tool-call" }] },
    }));
    expect(hookRuns("copilot", project)).toEqual([
      { command: "bun .aidlc/hooks/aidlc-copilot-adapter.ts guard-tool-call", traced: false },
    ]);
  });

  test("a harness the release ships that the check does not set up is named", () => {
    const shipped = (names: string[]) => ({ distributions: names.map((name) => ({ name })) });
    expect(uncheckedHarnesses(shipped(["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"]))).toEqual([]);
    expect(uncheckedHarnesses(shipped(["claude", "newcli"]))).toEqual(["newcli"]);
    expect(uncheckedHarnesses({})).toEqual([]);
  });

  test("the releases under test get no GitHub, Actions or provider credentials", () => {
    const env = childEnvironment({
      PATH: "/usr/bin", HOME: "/home/runner", SystemRoot: "C:\\Windows", RUNNER_TEMP: "/tmp/r", GITHUB_REPOSITORY: "o/r",
      GH_TOKEN: "x", GITHUB_TOKEN: "x", ACTIONS_RUNTIME_TOKEN: "x", ACTIONS_ID_TOKEN_REQUEST_URL: "x",
      AWS_SECRET_ACCESS_KEY: "x", ANTHROPIC_API_KEY: "x", NPM_TOKEN: "x", SOME_PASSWORD: "x", OTHER_API_KEY: "x",
    });
    expect(Object.keys(env).sort()).toEqual(["GITHUB_REPOSITORY", "HOME", "PATH", "RUNNER_TEMP", "SystemRoot"]);
  });

  test("a hook ran when the engine started, loaded it, and every end it logged was code 0", () => {
    const root = scratch();
    expect(tracedToCompletion(trace(join(root, "a"),
      { phase: "dispatcher-start", hook: "session-start" }, { phase: "hook-import-end" }, { phase: "hook-run-end", code: 0 },
      { phase: "exit", code: 0 }))).toBe(true);
    // The human-turn hook runs its code in a child process.
    expect(tracedToCompletion(trace(join(root, "b"),
      { phase: "dispatcher-start", hook: "record-human-turn" }, { phase: "hook-child-started" }, { phase: "hook-run-end", code: 0 }))).toBe(true);
    expect(tracedToCompletion(trace(join(root, "c"),
      { phase: "dispatcher-start", adapter: "kiro" }, { phase: "adapter-import-end" }, { phase: "exit", code: 1 }))).toBe(false);
    expect(tracedToCompletion(trace(join(root, "d"), { phase: "dispatcher-start", hook: "x" }, { phase: "exit", code: 0 }))).toBe(false);
    expect(tracedToCompletion(join(root, "none"))).toBe(false);
    // By name: what the plugin's events reached, each to its end.
    const both = trace(join(root, "e"), { phase: "dispatcher-start", hook: "session-start" }, { phase: "hook-import-end" },
      { phase: "exit", code: 0 });
    writeFileSync(join(both, "hook-2.ndjson"), [{ phase: "dispatcher-start", hook: "continue-workflow" }, { phase: "exit", code: 1 }]
      .map((phase) => JSON.stringify(phase)).join("\n"));
    expect([...hooksTracedToCompletion(both)]).toEqual(["session-start"]);
  });

  // Kiro IDE's shell-follow-up hooks are skipped before the engine loads when
  // nothing they read changed (#1946): that is the hook working, not failing.
  test("a hook the front gate skipped with code 0 ran to its end", () => {
    const root = scratch();
    const skip = (dir: string, code: number) => trace(join(root, dir),
      { phase: "dispatcher-start", adapter: "kiro-ide", target: "after-shell" },
      { phase: "adapter-front-gate-skip", target: "after-shell" },
      { phase: "exit", code });
    expect(tracedToCompletion(skip("a", 0))).toBe(true);
    expect(tracedToCompletion(skip("b", 1))).toBe(false);
  });

  // Kiro IDE always names the tool a PreToolUse guard checks; an empty payload
  // is one it never sends, and the guards rightly refuse it.
  test("Kiro IDE's tool-call guards get a tool call; every other hook an empty payload", () => {
    for (const target of ["guard-tool-call", "review-freeze", "state-transition-guard", "plan-approval-guard"]) {
      const input = JSON.parse(hookInput("kiro-ide", `aidlc engine adapter kiro-ide ${target}`));
      expect(input, target).toEqual({
        hook_event_name: "PreToolUse",
        tool_name: "execute_bash",
        tool_input: { command: "git status" },
      });
    }
    expect(hookInput("kiro-ide", "aidlc engine adapter kiro-ide after-shell")).toBe("{}");
    expect(hookInput("kiro", "aidlc engine adapter kiro guard-tool-call")).toBe("{}");
    expect(hookInput("claude", "aidlc engine hook review-freeze")).toBe("{}");
  });

  // On Windows the first command after an update writes bin\aidlc.exe and
  // removes the extensionless Git Bash launcher on purpose, so the check runs
  // the bare aidlc the hooks run instead of looking for a file.
  describe("the hooks' shell runs a bare aidlc that reports the candidate", () => {
    const target = "9.9.9-update-check";
    const shell = () => (process.platform === "win32" ? gitBashPath() : "/bin/sh");
    const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
    // PATH holds only the bin folder, so nothing installed on this machine answers.
    const bareIn = (bin: string) =>
      bareAidlcProblem(shell(), { ...process.env, AIDLC_BIN_DIR: bin, [pathKey]: bin }, target, bin, NATIVE_STARTUP_TIMEOUT_MS);
    const launcher = (bin: string, says: string) => {
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(bin, "aidlc"), `#!/bin/sh\necho "aidlc ${says}"\n`, { mode: 0o755 });
      return bin;
    };
    const skip = process.platform === "win32" && gitBashSkipReason() !== null;

    test.skipIf(skip)("a launcher that runs and reports the candidate passes; one that reports another release or nothing there fails", () => {
      const root = scratch();
      expect(bareIn(launcher(join(root, "current"), target))).toBeNull();
      expect(bareIn(launcher(join(root, "stale"), "1.0.0"))).toContain("1.0.0");
      const none = join(root, "none");
      mkdirSync(none);
      expect(bareIn(none)).not.toBeNull();
    });

    test.skipIf(process.platform !== "win32" || skip)("on Windows bin\\aidlc.exe alone is what Git Bash runs", () => {
      const root = scratch();
      const entry = join(root, "fake-aidlc.ts");
      writeFileSync(entry, `console.log(process.argv.includes("version") ? "aidlc ${target}" : "");\n`);
      const bin = join(root, "bin");
      mkdirSync(bin);
      const compiled = spawnSync(process.execPath, ["build", entry, "--compile", "--outfile", join(bin, "aidlc.exe")], {
        encoding: "utf-8",
        timeout: NATIVE_COMPILE_TIMEOUT_MS,
      });
      expect(compiled.status, `${compiled.stdout}\n${compiled.stderr}`).toBe(0);
      expect(bareIn(bin)).toBeNull();
    }, NATIVE_COMPILE_TIMEOUT_MS + NATIVE_STARTUP_TIMEOUT_MS);
  });

  // A copied project runs its own tool, so its wiring names `bun <dir>/tools/aidlc.ts`,
  // and Copilot and Cursor name their adapter file itself (dist/<harness> is the copy runtime's tree).
  test("a copied tree's hook commands are found on every harness that wires them in JSON", () => {
    const found = (harness: string, dir: string) => hookCommands(join(REPO_ROOT, "dist", harness, dir));
    expect(found("claude", ".claude")).toContain('bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts" engine hook session-start');
    expect(found("codex", ".codex")).toContain("bun .codex/tools/aidlc.ts engine adapter codex continue-workflow");
    expect(found("copilot", ".github")).toContain("bun .aidlc/hooks/aidlc-copilot-adapter.ts guard-tool-call");
    expect(found("cursor", ".cursor")).toContain("bun .cursor/hooks/aidlc-cursor-adapter.ts guards");
    expect(found("kiro", ".kiro")).toContain(`bun .kiro/tools/aidlc.ts engine adapter kiro continue-workflow${kiroManifest.hookCommandSuffix}`);
    expect(found("kiro-ide", ".kiro")).toContain("bun .kiro/tools/aidlc.ts engine adapter kiro-ide guard-tool-call");
  });

  test("only a command the engine's dispatcher runs is held to the hook phase trace", () => {
    expect(dispatched("aidlc engine hook session-start")).toBe(true);
    expect(dispatched('bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts" engine hook session-start')).toBe(true);
    expect(dispatched("bun .kiro/tools/aidlc.ts engine adapter kiro-ide guard-tool-call")).toBe(true);
    expect(dispatched("bun .aidlc/hooks/aidlc-copilot-adapter.ts guard-tool-call")).toBe(false);
    expect(dispatched("bun .cursor/hooks/aidlc-cursor-adapter.ts guards")).toBe(false);
    expect(JSON.parse(hookInput("kiro-ide", "bun .kiro/tools/aidlc.ts engine adapter kiro-ide guard-tool-call")).tool_name).toBe("execute_bash");
  });

  test("the copy runtime is the release's own asset, checked against its .sha256", () => {
    expect(copyRuntimeAsset("2.11.0")).toBe("aidlc-copy-runtime-2.11.0.tar.gz");
    const file = join(scratch(), "runtime.tar.gz");
    writeFileSync(file, "runtime\n");
    const digest = new Bun.CryptoHasher("sha256").update("runtime\n").digest("hex");
    expect(checksumMatches(file, `${digest}  aidlc-copy-runtime-2.11.0.tar.gz\n`)).toBe(true);
    expect(checksumMatches(file, `${digest.toUpperCase()}  aidlc-copy-runtime-2.11.0.tar.gz`)).toBe(true);
    expect(checksumMatches(file, `${"0".repeat(64)}  aidlc-copy-runtime-2.11.0.tar.gz\n`)).toBe(false);
    expect(checksumMatches(file, "")).toBe(false);
  });
});

describe("the Kiro name each release's config reads", () => {
  test("a release that names `kiro-v2` gets the typed names; an older one the ids", () => {
    const typed = scratch();
    mkdirSync(join(typed, "kiro-ide", ".kiro", "tools"), { recursive: true });
    writeFileSync(join(typed, "kiro-ide", ".kiro", "tools", "aidlc-runtime-paths.ts"), 'const N = { kiro: "kiro-v2", "kiro-ide": "kiro" };\n');
    const older = scratch();
    mkdirSync(join(older, "kiro", ".kiro", "tools"), { recursive: true });
    writeFileSync(join(older, "kiro", ".kiro", "tools", "aidlc-runtime-paths.ts"), "export const X = 1;\n");
    expect(["kiro", "kiro-ide", "claude"].map((harness) => harnessArgFor(typed, harness))).toEqual(["kiro-v2", "kiro", "claude"]);
    expect(["kiro", "kiro-ide", "claude"].map((harness) => harnessArgFor(older, harness))).toEqual(["kiro", "kiro-ide", "claude"]);
  });
});

describe("the release the candidate is updated from", () => {
  const FORK = "devsoftx/aidlc-workflows";
  const listing = (tags: Record<string, string[]>) => {
    const asked: string[] = [];
    return {
      asked,
      tagsOf: (repository: string) => {
        asked.push(repository);
        return tags[repository] ?? [];
      },
    };
  };

  test("a fork with no stable release of its own updates from upstream's newest one", () => {
    // A release made by hand, tagged "0.1", has no installer to update from.
    const fork = listing({ [FORK]: ["0.1"], [UPSTREAM_REPOSITORY]: ["v2.11.4", "v2.11.3", "v2.10.0"] });
    expect(previousRelease("v3.0.0", [FORK, UPSTREAM_REPOSITORY], fork.tagsOf))
      .toEqual({ tag: "v2.11.4", repository: UPSTREAM_REPOSITORY });
    expect(fork.asked).toEqual([FORK, UPSTREAM_REPOSITORY]);
  });

  test("once the fork has published one, upstream is not asked", () => {
    const fork = listing({ [FORK]: ["v3.0.0", "0.1"], [UPSTREAM_REPOSITORY]: ["v2.11.4"] });
    expect(previousRelease("v3.0.1", [FORK, UPSTREAM_REPOSITORY], fork.tagsOf))
      .toEqual({ tag: "v3.0.0", repository: FORK });
    expect(previousRelease("v3.0.1-preview.20261201.1", [FORK, UPSTREAM_REPOSITORY], fork.tagsOf))
      .toEqual({ tag: "v3.0.0", repository: FORK });
    expect(fork.asked).toEqual([FORK, FORK]);
  });

  test("only a release older than the candidate is one to update from, the newest version first", () => {
    const upstream = listing({ [UPSTREAM_REPOSITORY]: ["v3.1.0", "v3.0.0", "v2.10.5", "v2.11.4"] });
    expect(previousRelease("v3.0.0", [FORK, UPSTREAM_REPOSITORY], upstream.tagsOf))
      .toEqual({ tag: "v2.11.4", repository: UPSTREAM_REPOSITORY });
    // A preview built while main still records 2.11.4 is newer than 2.11.4, not than 3.0.0.
    const window = listing({ [FORK]: ["v3.0.0"], [UPSTREAM_REPOSITORY]: ["v2.11.4"] });
    expect(previousRelease("v2.11.5-preview.20261124.1", [FORK, UPSTREAM_REPOSITORY], window.tagsOf))
      .toEqual({ tag: "v2.11.4", repository: UPSTREAM_REPOSITORY });
    expect(previousRelease("v2.10.0", [FORK, UPSTREAM_REPOSITORY], window.tagsOf)).toBeNull();
  });

  test("the workflow step gets the tag and the repository, or a reason and a failure", () => {
    const output = join(scratch(), "github-output");
    writeFileSync(output, "");
    const fork = listing({ [FORK]: ["0.1"], [UPSTREAM_REPOSITORY]: ["v2.11.4"] });
    expect(findPrevious("v3.0.0", { GITHUB_REPOSITORY: FORK, GITHUB_OUTPUT: output }, fork.tagsOf)).toBe(0);
    expect(readFileSync(output, "utf-8")).toBe(`tag=v2.11.4\nrepository=${UPSTREAM_REPOSITORY}\n`);
    const none = join(scratch(), "github-output");
    writeFileSync(none, "");
    expect(findPrevious("v3.0.0", { GITHUB_REPOSITORY: FORK, GITHUB_OUTPUT: none }, listing({}).tagsOf)).toBe(1);
    expect(findPrevious("v3.0.0", { GITHUB_REPOSITORY: FORK, GITHUB_OUTPUT: none }, () => {
      throw new Error("gh release list --repo devsoftx/aidlc-workflows failed: HTTP 502");
    })).toBe(1);
    expect(readFileSync(none, "utf-8")).toBe("");
  });

  test("the previous installer and copy runtime come from the repository the release was found in", () => {
    expect(previousReleaseRepository({ GITHUB_REPOSITORY: FORK, AIDLC_PREVIOUS_RELEASE_REPOSITORY: UPSTREAM_REPOSITORY }))
      .toBe(UPSTREAM_REPOSITORY);
    expect(previousReleaseRepository({ GITHUB_REPOSITORY: FORK, AIDLC_PREVIOUS_RELEASE_REPOSITORY: "" })).toBe(FORK);
    expect(previousReleaseRepository({})).toBe(FORK);
  });

  test.each([".github/workflows/release.yml", ".github/workflows/preview-release.yml"])(
    "%s finds the release with the token and passes its repository to the update, not the token",
    (path) => {
      type Step = { name?: string; id?: string; uses?: string; run?: string; env?: Record<string, string> };
      const workflow = Bun.YAML.parse(readFileSync(join(REPO_ROOT, path), "utf-8")) as { jobs: Record<string, { steps?: Step[] }> };
      const steps = workflow.jobs["update-from-previous"].steps ?? [];
      const find = steps.find((step) => step.name === "Find the last stable release");
      const update = steps.find((step) => step.name === "Update from the last release");
      expect(find?.id).toBe("previous");
      expect(find?.run).toBe('bun scripts/ci-update-from-previous.ts --find-previous "$CANDIDATE_TAG"');
      expect(find?.env?.GH_TOKEN).toBe(`\${{ github.token }}`);
      expect(update?.env?.PREVIOUS_TAG).toBe(`\${{ steps.previous.outputs.tag }}`);
      expect(update?.env?.AIDLC_PREVIOUS_RELEASE_REPOSITORY).toBe(`\${{ steps.previous.outputs.repository }}`);
      expect(update?.env?.GH_TOKEN).toBeUndefined();
      expect(Object.keys(update?.env ?? {})).not.toContain("AIDLC_RELEASE_REPOSITORY");
      // Bun is set up before the lookup runs it.
      expect(steps.findIndex((step) => step.uses?.startsWith("oven-sh/setup-bun"))).toBeGreaterThanOrEqual(0);
      expect(steps.findIndex((step) => step.uses?.startsWith("oven-sh/setup-bun"))).toBeLessThan(steps.indexOf(find!));
    },
  );
});
