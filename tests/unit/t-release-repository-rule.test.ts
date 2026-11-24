// covers: function:releaseRepositoryFor function:releaseTrust function:defaultReleaseBaseUrl function:copyRuntimeUrl function:releaseHostLabel function:releasesPage function:resolvePreviewVersion function:fetchReleaseMetadata
//
// Which repository a release comes from, for its download and its provenance.
// A stable release before 3.0.0 is upstream's (awslabs/aidlc-workflows): this
// repository never republishes it, so going back to one, or a project pinned
// to one, still works. Every preview, every later stable release and the
// newest release are this repository's (devsoftx/aidlc-workflows).
// AIDLC_RELEASE_REPOSITORY, AIDLC_RELEASE_BASE_URL and AIDLC_RELEASE_WORKFLOW,
// when set, win for every version.
//
// The rule has one owner, releaseRepositoryFor in core/tools/aidlc-release.ts.
// scripts/install.sh, scripts/install.ps1 and the test gh stub
// (tests/fixtures/bin/gh.ts) cannot import it and carry their own copy, so the
// same table runs against each of them here and fails when one drifts.

import { NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyRuntimeUrl,
  DEFAULT_RELEASE_REPOSITORY,
  defaultReleaseBaseUrl,
  fetchReleaseMetadata,
  releaseHostLabel,
  releaseRepositoryFor,
  releasesPage,
  releaseTrust,
  resolvePreviewVersion,
  UPSTREAM_RELEASE_REPOSITORY,
  UPSTREAM_STABLE_BEFORE,
} from "../../core/tools/aidlc-release.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const INSTALL_SH_PATH = join(REPO_ROOT, "scripts", "install.sh");
const INSTALL_SH = readFileSync(INSTALL_SH_PATH, "utf-8");
const INSTALL_PS1 = readFileSync(join(REPO_ROOT, "scripts", "install.ps1"), "utf-8");
const FIXTURE_GH = join(REPO_ROOT, "tests", "fixtures", "bin", "gh.ts");
const FORK = "devsoftx/aidlc-workflows";
const UPSTREAM = "awslabs/aidlc-workflows";
const OTHER = "alice/aidlc-workflows";

// Every version shape the rule tells apart, around its 3.0.0 edge.
const VERSIONS = [
  "0.1.0",
  "1.9.9",
  "2.8.0",
  "2.11.4",
  "2.99.0",
  "3.0.0",
  "3.0.1",
  "3.10.0",
  "10.0.0",
  "20.0.0",
  "2.11.1-preview.20261016.1",
  "2.11.5-preview.20261124.1",
  "3.0.0-preview.20270101.2",
];

const ENV_KEYS = [
  "AIDLC_RELEASE_REPOSITORY",
  "AIDLC_RELEASE_WORKFLOW",
  "AIDLC_RELEASE_BASE_URL",
  "AIDLC_RELEASE_API_URL",
  "AIDLC_INSTALL_ROOT",
  "AIDLC_OFFLINE",
  "AIDLC_GH_BIN",
  "AIDLC_ROUTE_NETWORK_POLICY",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const created: string[] = [];

function temp(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  created.push(directory);
  return directory;
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  // No machine setting of the person running the tests can name a mirror.
  process.env.AIDLC_INSTALL_ROOT = temp("aidlc-repository-rule-root-");
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  while (created.length > 0) rmSync(created.pop() as string, { recursive: true, force: true });
});

// The environment a copy of the rule runs in: the variables the rule reads,
// and nothing inherited that could name another repository.
function ruleEnv(repository?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  if (repository !== undefined) env.AIDLC_RELEASE_REPOSITORY = repository;
  return env;
}

function withRepository<T>(repository: string | undefined, run: () => T): T {
  if (repository === undefined) delete process.env.AIDLC_RELEASE_REPOSITORY;
  else process.env.AIDLC_RELEASE_REPOSITORY = repository;
  try {
    return run();
  } finally {
    delete process.env.AIDLC_RELEASE_REPOSITORY;
  }
}

// install.sh's release_repository_for, run on its own through sh.
function shellRule(version: string, repository?: string): string {
  const body = /^release_repository_for\(\) \{\n[\s\S]*?\n\}$/m.exec(INSTALL_SH)?.[0];
  if (!body) throw new Error("install.sh has no release_repository_for function");
  const result = spawnSync("sh", ["-c", `${body}\nrelease_repository_for "$1"`, "rule", version], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    encoding: "utf-8",
    env: ruleEnv(repository),
  });
  if (result.error) throw result.error;
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

// install.ps1's Get-ReleaseRepository, read as the closed shape it is written
// in: the environment override, then `-cmatch` cases, then the fallback. A
// line in any other shape fails the read, so a rewrite is checked again here.
function powershellFunction(): string {
  const body = /^function Get-ReleaseRepository \{\n[\s\S]*?\n\}$/m.exec(INSTALL_PS1)?.[0];
  if (!body) throw new Error("install.ps1 has no Get-ReleaseRepository function");
  return body;
}

function powershellRule(version: string, repository?: string): string {
  const lines = powershellFunction().split("\n").slice(1, -1).map((line) => line.trim());
  expect(lines[0]).toBe("param([string]$ForVersion)");
  expect(lines[1]).toBe(
    "if ($env:AIDLC_RELEASE_REPOSITORY) { return $env:AIDLC_RELEASE_REPOSITORY }",
  );
  if (repository) return repository;
  for (const line of lines.slice(2)) {
    const branch = /^if \(\$ForVersion -cmatch '([^']+)'\) \{ return '([^']+)' \}$/.exec(line);
    if (branch) {
      if (new RegExp(branch[1]).test(version)) return branch[2];
      continue;
    }
    const fallback = /^return '([^']+)'$/.exec(line);
    if (fallback) return fallback[1];
    throw new Error(`install.ps1 Get-ReleaseRepository has an unread line: ${line}`);
  }
  throw new Error("install.ps1 Get-ReleaseRepository has no fallback");
}

// The same function run by PowerShell itself, where it is installed.
const POWERSHELL = Bun.which("pwsh") ?? Bun.which("powershell");

function powershellRun(versions: readonly string[], repository?: string): string[] {
  const script = [
    powershellFunction(),
    ...versions.map((version) => `Get-ReleaseRepository -ForVersion '${version}'`),
  ].join("\n");
  const result = spawnSync(POWERSHELL as string, ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    encoding: "utf-8",
    env: ruleEnv(repository),
  });
  if (result.error) throw result.error;
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

// Whether the test gh stub accepts a check against this repository and
// workflow for a release of this version.
function stubAccepts(
  version: string,
  trust: { repository: string; workflow: string },
  repository?: string,
): boolean {
  const directory = temp("aidlc-repository-rule-gh-");
  writeFileSync(join(directory, "version.json"), `${JSON.stringify({ version })}\n`);
  writeFileSync(join(directory, "checksums.txt"), "fixture checksums\n");
  writeFileSync(join(directory, "aidlc-release.intoto.jsonl"), "aidlc-test-release-provenance\n");
  const result = spawnSync(process.execPath, [
    FIXTURE_GH,
    "attestation",
    "verify",
    join(directory, "checksums.txt"),
    "--bundle",
    join(directory, "aidlc-release.intoto.jsonl"),
    "--repo",
    trust.repository,
    "--signer-workflow",
    trust.workflow,
    "--hostname",
    "github.com",
  ], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    encoding: "utf-8",
    env: ruleEnv(repository),
  });
  if (result.error) throw result.error;
  return result.status === 0;
}

function workflowOf(repository: string, version: string): string {
  return `${repository}/.github/workflows/${version.includes("-preview.") ? "preview-release.yml" : "release.yml"}`;
}

describe("the release repository rule", () => {
  test("names the two repositories and the first stable release of this repository", () => {
    expect(DEFAULT_RELEASE_REPOSITORY).toBe(FORK);
    expect(UPSTREAM_RELEASE_REPOSITORY).toBe(UPSTREAM);
    expect(UPSTREAM_STABLE_BEFORE).toBe("3.0.0");
  });

  test("going back to 2.11.4 downloads from and verifies against upstream", () => {
    expect(releaseRepositoryFor("2.11.4")).toBe(UPSTREAM);
    expect(defaultReleaseBaseUrl("2.11.4")).toBe("https://github.com/awslabs/aidlc-workflows/releases");
    expect(releaseTrust("2.11.4")).toEqual({
      repository: UPSTREAM,
      workflow: "awslabs/aidlc-workflows/.github/workflows/release.yml",
    });
    expect(copyRuntimeUrl("2.11.4")).toBe(
      "https://github.com/awslabs/aidlc-workflows/releases/download/v2.11.4/aidlc-copy-runtime-2.11.4.tar.gz",
    );
    expect(releaseHostLabel(undefined, "2.11.4")).toBe("github.com/awslabs/aidlc-workflows");
  });

  test("3.0.0, a preview, and the newest release come from this repository", () => {
    expect(releaseRepositoryFor("3.0.0")).toBe(FORK);
    expect(defaultReleaseBaseUrl("3.0.0")).toBe("https://github.com/devsoftx/aidlc-workflows/releases");
    expect(releaseTrust("3.0.0")).toEqual({
      repository: FORK,
      workflow: "devsoftx/aidlc-workflows/.github/workflows/release.yml",
    });
    expect(copyRuntimeUrl("3.0.0")).toBe(
      "https://github.com/devsoftx/aidlc-workflows/releases/download/v3.0.0/aidlc-copy-runtime-3.0.0.tar.gz",
    );
    const preview = "2.11.5-preview.20261124.1";
    expect(releaseRepositoryFor(preview)).toBe(FORK);
    expect(defaultReleaseBaseUrl(preview)).toBe("https://github.com/devsoftx/aidlc-workflows/releases");
    expect(releaseTrust(preview)).toEqual({
      repository: FORK,
      workflow: "devsoftx/aidlc-workflows/.github/workflows/preview-release.yml",
    });
    // No version named: the latest/ endpoint, which is this repository's.
    expect(releaseRepositoryFor()).toBe(FORK);
    expect(defaultReleaseBaseUrl()).toBe("https://github.com/devsoftx/aidlc-workflows/releases");
    expect(releaseHostLabel()).toBe("github.com/devsoftx/aidlc-workflows");
  });

  test("the settings win for every version", () => {
    process.env.AIDLC_RELEASE_REPOSITORY = OTHER;
    for (const version of ["2.11.4", "3.0.0", "2.11.5-preview.20261124.1"]) {
      expect(releaseRepositoryFor(version)).toBe(OTHER);
      expect(defaultReleaseBaseUrl(version)).toBe(`https://github.com/${OTHER}/releases`);
      expect(releaseTrust(version)).toEqual({ repository: OTHER, workflow: workflowOf(OTHER, version) });
    }
    expect(copyRuntimeUrl("2.11.4")).toBe(
      `https://github.com/${OTHER}/releases/download/v2.11.4/aidlc-copy-runtime-2.11.4.tar.gz`,
    );
    process.env.AIDLC_RELEASE_WORKFLOW = "alice/aidlc-workflows/.github/workflows/sign.yml";
    expect(releaseTrust("2.11.4").workflow).toBe("alice/aidlc-workflows/.github/workflows/sign.yml");
    expect(releaseTrust("3.0.0").workflow).toBe("alice/aidlc-workflows/.github/workflows/sign.yml");
    delete process.env.AIDLC_RELEASE_REPOSITORY;
    delete process.env.AIDLC_RELEASE_WORKFLOW;
    // A mirror serves every version; the release it serves keeps the
    // attestation of the repository that published it.
    process.env.AIDLC_RELEASE_BASE_URL = "https://github.com/alice/mirror/releases";
    expect(copyRuntimeUrl("2.11.4")).toBe(
      "https://github.com/alice/mirror/releases/download/v2.11.4/aidlc-copy-runtime-2.11.4.tar.gz",
    );
    expect(copyRuntimeUrl("3.0.0")).toBe(
      "https://github.com/alice/mirror/releases/download/v3.0.0/aidlc-copy-runtime-3.0.0.tar.gz",
    );
    expect(releaseHostLabel(undefined, "2.11.4")).toBe("github.com/alice/mirror");
    expect(releaseTrust("2.11.4").repository).toBe(UPSTREAM);
  });

  test("install.sh, install.ps1 and the test gh stub follow the same rule", () => {
    for (const repository of [undefined, OTHER]) {
      const expected = VERSIONS.map((version) => withRepository(repository, () => releaseRepositoryFor(version)));
      const latest = withRepository(repository, () => releaseRepositoryFor());
      expect(VERSIONS.map((version) => shellRule(version, repository))).toEqual(expected);
      expect(shellRule("", repository)).toBe(latest);
      expect(VERSIONS.map((version) => powershellRule(version, repository))).toEqual(expected);
      expect(powershellRule("", repository)).toBe(latest);
      if (POWERSHELL) {
        expect(powershellRun([...VERSIONS, ""], repository)).toEqual([...expected, latest]);
      }
      for (const version of VERSIONS) {
        const trust = withRepository(repository, () => releaseTrust(version));
        expect(stubAccepts(version, trust, repository), `${version} ${trust.repository}`).toBe(true);
        const other = trust.repository === UPSTREAM ? FORK : UPSTREAM;
        expect(
          stubAccepts(version, { repository: other, workflow: workflowOf(other, version) }, repository),
          `${version} ${other}`,
        ).toBe(false);
      }
    }
  });

  test("both installers pick the download by the version asked for and the check by the version received", () => {
    expect(INSTALL_SH).toContain('BASE_URL="https://github.com/$(release_repository_for "$VERSION")/releases"');
    expect(INSTALL_SH).toContain('RELEASE_REPOSITORY=$(release_repository_for "$candidate_version")');
    expect(INSTALL_PS1).toContain(
      '$ReleaseBaseUrl = "https://github.com/$(Get-ReleaseRepository -ForVersion $Version)/releases"',
    );
    expect(INSTALL_PS1).toContain("$releaseRepository = Get-ReleaseRepository -ForVersion $manifest.version");
  });
});

// install.sh up to its first download or its provenance check, with curl and
// gh replaced by recorders that fail, so nothing is fetched or installed.
describe.skipIf(process.platform === "win32")("install.sh resolves the repository for the version", () => {
  function runInstaller(args: string[], env: Record<string, string> = {}): { status: number | null; log: string } {
    const home = temp("aidlc-repository-rule-home-");
    const bin = join(home, "fake-bin");
    mkdirSync(bin);
    const log = join(home, "calls.log");
    writeFileSync(log, "");
    writeFileSync(join(bin, "curl"), `#!/bin/sh\nprintf 'curl %s\\n' "$*" >>"${log}"\nexit 22\n`);
    chmodSync(join(bin, "curl"), 0o755);
    const gh = join(bin, "gh");
    writeFileSync(
      gh,
      [
        "#!/bin/sh",
        'if [ "$3" = --help ]; then',
        "  printf '%s\\n' '--signer-workflow --source-ref --source-digest'",
        "  exit 0",
        "fi",
        `printf 'gh %s\\n' "$*" >>"${log}"`,
        "exit 1",
        "",
      ].join("\n"),
    );
    chmodSync(gh, 0o755);
    const base = ruleEnv();
    delete base.SUDO_USER;
    const result = spawnSync("sh", [INSTALL_SH_PATH, "--allow-root", "--quiet", ...args], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
      encoding: "utf-8",
      env: {
        ...base,
        HOME: home,
        PATH: `${bin}:/usr/bin:/bin`,
        AIDLC_BIN_DIR: join(home, "bin"),
        AIDLC_INSTALL_ROOT: join(home, "share", "aidlc"),
        AIDLC_GH_BIN: gh,
        ...env,
      },
    });
    if (result.error) throw result.error;
    return { status: result.status, log: readFileSync(log, "utf-8") };
  }

  function fromRelease(version: string): string {
    const directory = temp("aidlc-repository-rule-from-");
    writeFileSync(join(directory, "version.json"), `{"schemaVersion": 1, "version": "${version}"}\n`);
    for (const name of ["checksums.txt", "aidlc-release.intoto.jsonl", "install.sh"]) {
      writeFileSync(join(directory, name), "fixture\n");
    }
    return directory;
  }

  test("the download URL", () => {
    const urls = (args: string[], env?: Record<string, string>): string => {
      const { status, log } = runInstaller(args, env);
      expect(status).toBe(3);
      return /curl .*?(https?:\/\/\S+)/.exec(log)?.[1] ?? "";
    };
    expect(urls(["--version", "2.11.4"])).toBe(
      "https://github.com/awslabs/aidlc-workflows/releases/download/v2.11.4/version.json",
    );
    expect(urls(["--version", "3.0.0"])).toBe(
      "https://github.com/devsoftx/aidlc-workflows/releases/download/v3.0.0/version.json",
    );
    expect(urls(["--version", "2.11.5-preview.20261124.1"])).toBe(
      "https://github.com/devsoftx/aidlc-workflows/releases/download/v2.11.5-preview.20261124.1/version.json",
    );
    expect(urls([])).toBe("https://github.com/devsoftx/aidlc-workflows/releases/latest/download/version.json");
    expect(urls(["--version", "2.11.4"], { AIDLC_RELEASE_REPOSITORY: OTHER })).toBe(
      `https://github.com/${OTHER}/releases/download/v2.11.4/version.json`,
    );
    expect(urls(["--version", "2.11.4"], { AIDLC_RELEASE_BASE_URL: "https://mirror.example/releases" })).toBe(
      "https://mirror.example/releases/download/v2.11.4/version.json",
    );
    expect(urls(["--version", "3.0.0", "--release-base-url", "https://mirror.example/aidlc"])).toBe(
      "https://mirror.example/aidlc/download/v3.0.0/version.json",
    );
  });

  test("the provenance check", () => {
    const check = (version: string, env?: Record<string, string>): string => {
      const { status, log } = runInstaller(["--from", fromRelease(version)], env);
      expect(status).toBe(4);
      const call = /^gh (.*)$/m.exec(log)?.[1] ?? "";
      const repository = /--repo (\S+)/.exec(call)?.[1];
      const workflow = /--signer-workflow (\S+)/.exec(call)?.[1];
      return `${repository} ${workflow}`;
    };
    expect(check("2.11.4")).toBe(`${UPSTREAM} ${workflowOf(UPSTREAM, "2.11.4")}`);
    expect(check("3.0.0")).toBe(`${FORK} ${workflowOf(FORK, "3.0.0")}`);
    expect(check("2.11.5-preview.20261124.1")).toBe(
      `${FORK} ${workflowOf(FORK, "2.11.5-preview.20261124.1")}`,
    );
    expect(check("2.11.4", { AIDLC_RELEASE_REPOSITORY: OTHER })).toBe(`${OTHER} ${workflowOf(OTHER, "2.11.4")}`);
    expect(check("2.11.4", { AIDLC_RELEASE_WORKFLOW: "alice/aidlc-workflows/.github/workflows/sign.yml" })).toBe(
      `${UPSTREAM} alice/aidlc-workflows/.github/workflows/sign.yml`,
    );
  });
});

describe("what a person is told", () => {
  test("the releases page follows AIDLC_RELEASE_REPOSITORY and never prints a mirror's secrets", () => {
    expect(releasesPage()).toBe("https://github.com/devsoftx/aidlc-workflows/releases");
    process.env.AIDLC_RELEASE_REPOSITORY = OTHER;
    expect(releasesPage()).toBe(`https://github.com/${OTHER}/releases`);
    process.env.AIDLC_RELEASE_REPOSITORY = "not a repository";
    expect(releasesPage()).toBe("the configured release mirror");
    delete process.env.AIDLC_RELEASE_REPOSITORY;
    expect(releasesPage("https://mirror.example/token-123/releases")).toBe("https://mirror.example");
    expect(releasesPage("http://mirror.example/releases")).toBe("the configured release mirror");
  });

  test("a preview list too large to read names the configured repository's releases", async () => {
    // Past the 4 MiB a release list page may hold.
    const page = `[${" ".repeat(5 * 1024 * 1024)}]`;
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response(page, { headers: { "content-type": "application/json" } }),
    });
    try {
      process.env.AIDLC_RELEASE_REPOSITORY = OTHER;
      const error = await resolvePreviewVersion({ apiUrl: `http://127.0.0.1:${server.port}/releases` })
        .then(() => null, (failure: unknown) => failure as Error & { code?: string });
      expect(error?.code).toBe("preview-list-too-large");
      expect(error?.message).toContain(`id from https://github.com/${OTHER}/releases`);
      expect(error?.message).not.toContain(`${DEFAULT_RELEASE_REPOSITORY}/`);
    } finally {
      server.stop(true);
    }
  });

  test("a release before 3.0.0 missing from a configured repository is named as upstream's", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("missing", { status: 404 }) });
    const baseUrl = `http://127.0.0.1:${server.port}/releases`;
    try {
      const failure = (version: string) =>
        fetchReleaseMetadata({ version, baseUrl, verifyProvenance: false })
          .then(() => "", (error: unknown) => (error as Error).message);
      const upstream = await failure("2.11.4");
      expect(upstream).toBe(
        `AI-DLC 2.11.4 is not published at 127.0.0.1:${server.port}. Releases before 3.0.0 are published at ` +
          "github.com/awslabs/aidlc-workflows, where AI-DLC gets them when no release repository or mirror " +
          "is set: run this again without the release mirror setting, or pass --from <release-directory>.",
      );
      expect(upstream).not.toContain("No published native release");
      process.env.AIDLC_RELEASE_REPOSITORY = FORK;
      expect(await failure("2.11.4")).toContain(
        "run this again without AIDLC_RELEASE_REPOSITORY and the release mirror setting",
      );
      delete process.env.AIDLC_RELEASE_REPOSITORY;
      // A release of this repository missing there is not upstream's.
      expect(await failure("3.0.0")).toContain("No published native release is available yet");
      expect(await failure("2.11.5-preview.20261124.1")).toContain("No published native release is available yet");
    } finally {
      server.stop(true);
    }
  });
});
