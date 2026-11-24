// buildDictionary(): a one-word value that is also an ordinary word (a git
// first name "Will", a project folder "requirements") would replace that word
// everywhere and wreck the report ("the agent <user> retry <project>-analysis").
// Such words are left out of the replacement list and listed as skipped, while
// the full name and the paths that hold them are still replaced.

import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { buildDictionary, type Dictionary, redact } from "../../core/skills/aidlc-issue-report/scripts/redact.ts";
import { textHits } from "../../core/skills/aidlc-issue-report/scripts/lib-gate.ts";

// What the check (lib-gate.ts) refuses in a line of the report, with no AI-DLC words known.
// No chat names itself to the tools: this process reads the audit in-process and spawns the engine with the inherited
// environment, and a host chat's identity would point both at the wrong shard. Restored after this file.
const HOST_CHAT_VARS = [
  "CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "CODEX_THREAD_ID", "KIRO_SESSION_ID",
  "AIDLC_SESSION_OVERRIDE", "AIDLC_SESSION_OVERRIDE_SOURCE",
] as const;
const hostChat = Object.fromEntries(HOST_CHAT_VARS.map((key) => [key, process.env[key]]));
for (const key of HOST_CHAT_VARS) delete process.env[key];
afterAll(() => {
  for (const key of HOST_CHAT_VARS) {
    const value = hostChat[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const gate = (text: string, dict: Dictionary) => textHits({ words: new Set(), dict }, text);
// The machine's own host name can be an ordinary word, so redaction records it as a
// skip. Only this machine's name may appear as a host skip; these cases are about the
// git name and the folder, so those entries are checked and then set apart.
const skippedNotHost = (dict: Dictionary) => {
  const hostNames = [hostname(), hostname().split(".")[0]];
  const entries = dict.skipped ?? [];
  for (const e of entries) if (e.kind === "host") expect(hostNames).toContain(e.value);
  return entries.filter((e) => e.kind !== "host");
};

function project(folder: string, gitName: string): string {
  const p = join(mkdtempSync(join(tmpdir(), "dict-test-")), folder);
  mkdirSync(p);
  execFileSync("git", ["init", "-q"], { cwd: p });
  execFileSync("git", ["config", "user.name", gitName], { cwd: p });
  return p;
}

test("ordinary words are not replaced; the full name and the path are", () => {
  const p = project("requirements", "Will Parker");
  const d = buildDictionary(p);
  const prose = "The agent will retry requirements-analysis.";
  expect(redact(prose, d)).toBe(prose);
  expect(gate(prose, d)).toEqual([]);
  expect(redact("Will Parker approved it.", d)).toBe("<user> approved it.");
  expect(redact("Parker approved it.", d)).toBe("<user> approved it.");
  expect(redact(`opened ${p}/src/index.ts`, d)).toBe("opened <project>/src/index.ts");
  expect(skippedNotHost(d).map((e) => e.value).sort()).toEqual(["Will", "requirements"]);
});

test("a distinctive project name is still replaced as a word", () => {
  const p = project("acmecorp-portal", "Jordan Quill");
  const d = buildDictionary(p);
  expect(redact("the acmecorp-portal build failed", d)).toBe("the <project> build failed");
  expect(skippedNotHost(d)).toEqual([]);
});

test("an intent's dated folder and its bare slug share one label", () => {
  const p = project("shop", "Jordan Quill");
  const d = buildDictionary(p, { intents: ["261017-shop-checkout", "261020-table-order"] });
  expect(redact("261017-shop-checkout and shop-checkout and table-order", d)).toBe("<intent-1> and <intent-1> and <intent-2>");
});

test("an AI-DLC install outside the home folder is a path of its own", () => {
  const p = project("shop", "Jordan Quill");
  const d = buildDictionary(p, { paths: [{ value: "/mnt/acme-tools/aidlc", label: "<aidlc-install>" }] });
  expect(redact("installed in /mnt/acme-tools/aidlc/versions/2.11.2/aidlc", d)).toBe("installed in <aidlc-install>/versions/2.11.2/aidlc");
});

test("a Windows path is replaced as either separator writes it", () => {
  const d = buildDictionary(process.cwd(), { paths: [{ value: "D:\\work\\aidlc", label: "<aidlc-install>" }] });
  expect(redact("ran D:/work/aidlc/bin/aidlc.exe", d)).toBe("ran <aidlc-install>/bin/aidlc.exe");
  expect(redact("ran D:\\work\\aidlc\\bin", d)).toBe("ran <aidlc-install>\\bin");
});

test("a git remote's port is not taken for an owner", () => {
  const p = project("shop", "Jordan Quill");
  execFileSync("git", ["remote", "add", "origin", "ssh://git@git.fabrikam.example:2222/fabteam/shop-app.git"], { cwd: p });
  const values = buildDictionary(p).entries.map((e) => e.value);
  expect(values).not.toContain("2222");
  expect(values).toContain("fabteam");
  expect(values).toContain("shop-app");
});
