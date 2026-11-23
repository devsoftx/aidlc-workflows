// covers: function:evaluateCodeGenerationApproval, function:planApprovalPromptSha256
//
// A code plan approved on a five-phase AI-DLC (2.11.4) named its questions file
// at construction/code-generation/ on the receipt the approval wrote and on the
// PLAN_APPROVAL_RECORDED row a teammate's clone reads. The 8 to 10 state step
// moves that folder to build/code-generation/ and leaves both records as they
// were written, so the plan the person approved is still approved after the
// update: the engine asks nothing and the build starts. The approval still binds
// the plan, the attempt and the prompt the person saw: a record naming another
// file, or a plan changed since, is still asked about.
//
// Real git clones and the real `next`, human-turn hook, answer command and
// plan-approval guard; the receipt and the row are given the five-phase
// spelling a 2.11.4 run wrote.
import { NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AIDLC_SRC, cleanupTestProject, createOrchestrationTestProject, FIXTURES_DIR, runOrchestrateNext, seededRecordDir,
  seededStateFile,
} from "../harness/fixtures.ts";
import { phaseFor } from "../harness/stage-phase.ts";
import { renderTestingContract, resolveTestingPosture } from "../../dist/claude/.claude/tools/aidlc-testing-posture.ts";

setDefaultTimeout(180_000);

const BUN = process.execPath;
const ORCHESTRATE = join(AIDLC_SRC, "tools", "aidlc-orchestrate.ts");
const DISPATCHER = join(AIDLC_SRC, "tools", "aidlc.ts");
const GUARD = join(AIDLC_SRC, "hooks", "aidlc-plan-approval-guard.ts");
const ALICE = "01995000-7a11-7000-8000-00000000a11c";
const BOB = "01995000-7a11-7000-8000-000000000b0b";
const PIECE = "fixture-8000000000000001";
const RECORD = `aidlc/spaces/default/intents/${PIECE}`;
const SEVEN = `${RECORD}/${phaseFor("code-generation")}/code-generation/`;
const FIVE = `${RECORD}/construction/code-generation/`;

const created: string[] = [];
afterEach(() => {
  while (created.length > 0) cleanupTestProject(created.pop());
});

type Step = Record<string, unknown> & { kind?: string; ask_type?: string; plan_approval?: Record<string, unknown> };

const engineEnv = (proj: string, chat: string) => ({
  ...process.env, CLAUDE_PROJECT_DIR: proj, AIDLC_PROJECT_DIR: proj, AIDLC_UNATTENDED: "0", AIDLC_SESSION_OVERRIDE: chat,
});

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", [
    "-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "init.defaultBranch=main",
    "-c", "maintenance.auto=false", "-c", "gc.auto=0", ...args,
  ], { cwd, encoding: "utf-8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
  expect(result.status, `git ${args.join(" ")}\n${result.stderr}`).toBe(0);
  return result.stdout ?? "";
}

/** Alice's checkout at Code Generation, committed with the .gitignore AI-DLC ships. */
function alicesCheckout(): string {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  const state = readFileSync(join(FIXTURES_DIR, "state-brownfield-feature.md"), "utf-8")
    .replace("- **Scope**: feature", "- **Scope**: poc")
    .replace("- **Change Control**: strict (from scope feature)",
      "- **Guard Policy**: strict (from scope poc)\n- **Plan Approval**: on (set by you)")
    .replace(/^- \*\*Current Stage\*\*:.*$/m, "- **Current Stage**: code-generation");
  writeFileSync(seededStateFile(proj), state, "utf-8");
  mkdirSync(join(proj, "src"), { recursive: true });
  writeFileSync(join(proj, "src", "base.ts"), "export const base = true;\n", "utf-8");
  writeFileSync(join(proj, ".gitignore"), readFileSync(join(AIDLC_SRC, "..", ".gitignore"), "utf-8"));
  git(proj, ["init", "-q"]);
  git(proj, ["add", "-A"]);
  git(proj, ["commit", "-qm", "work at code generation"]);
  return proj;
}

const stageDir = (proj: string) => join(seededRecordDir(proj), phaseFor("code-generation"), "code-generation");

function writePlan(proj: string, extra = ""): void {
  mkdirSync(stageDir(proj), { recursive: true });
  writeFileSync(join(stageDir(proj), "code-generation-plan.md"),
    "# Code Generation Plan\n\n## Summary\n\n- Builds: slugify for titles\n- Touches: src/slugify.ts\n" +
      `- Tests: 3 unit tests\n\n## Steps\n\n- [ ] Step 1: write slugify\n${extra}\n` +
      renderTestingContract(resolveTestingPosture(proj)), "utf-8");
  writeFileSync(join(stageDir(proj), "unit-test-instructions.md"),
    "# Unit Test Instructions\n\nRun `bun test src/slugify.test.ts`.\n", "utf-8");
}

function next(proj: string, args: string[] = []): Step {
  const result = runOrchestrateNext(ORCHESTRATE, proj, args, { env: { ...process.env, AIDLC_UNATTENDED: "0" } });
  expect(result.status, result.out).toBe(0);
  return result.directive as Step;
}

function says(proj: string, prompt: string, chat: string): void {
  const result = spawnSync(BUN, [DISPATCHER, "engine", "hook", "record-human-turn"], {
    cwd: proj, encoding: "utf-8",
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: chat, prompt }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: proj, AIDLC_PROJECT_DIR: proj, AIDLC_UNATTENDED: "0" },
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  expect(result.status, result.stderr).toBe(0);
}

function engine(proj: string, chat: string, tool: string, args: string[]): { code: number; out: string } {
  const result = spawnSync(BUN, [join(AIDLC_SRC, "tools", tool), ...args, "--project-dir", proj], {
    cwd: proj, encoding: "utf-8", env: engineEnv(proj, chat),
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  return { code: result.status ?? -1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function answerLine(proj: string): string | undefined {
  const text = readFileSync(join(stageDir(proj), "code-generation-questions.md"), "utf-8");
  return /^\[Answer\]:.*$/m.exec(text)?.[0];
}

/** Alice approves the plan the engine asks about, in her own words. */
function approvedByAlice(): string {
  const alice = alicesCheckout();
  writePlan(alice);
  expect(next(alice)).toMatchObject({ kind: "ask", ask_type: "plan-approval" });
  says(alice, "looks good, approve it", ALICE);
  const recorded = engine(alice, ALICE, "aidlc-log.ts",
    ["answer", "--stage", "code-generation", "--checkpoint", "plan-approval", "--details", "Approve Plan"]);
  expect(recorded.code, recorded.out).toBe(0);
  expect(next(alice).plan_approval).toEqual({ status: "approved" });
  return alice;
}

const receiptsDir = (proj: string) => join(proj, "aidlc", ".aidlc-sessions", "plan-approval");

/** Each Plan Approval receipt this checkout holds, with its questions file spelled as `spell` gives it. */
function receiptsSpelled(proj: string, spell: (questionsFile: string) => string): void {
  const names = readdirSync(receiptsDir(proj)).filter((name) => name.startsWith("receipt-"));
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    const path = join(receiptsDir(proj), name);
    const receipt = JSON.parse(readFileSync(path, "utf-8")) as { questionsFile: string };
    expect(receipt.questionsFile.startsWith(SEVEN)).toBe(true);
    writeFileSync(path, JSON.stringify({ ...receipt, questionsFile: spell(receipt.questionsFile) }, null, 2));
  }
}

/** Every audit row of this checkout naming the plan's folder, as a five-phase release wrote it. */
function rowsSpelled(proj: string, folder: string): void {
  const audit = join(seededRecordDir(proj), "audit");
  for (const name of readdirSync(audit)) {
    const path = join(audit, name);
    const text = readFileSync(path, "utf-8");
    writeFileSync(path, text.replaceAll(SEVEN, folder));
  }
}

/** The developer handoff the build step names, as the plan-approval guard sees it. */
function handoff(proj: string, chat: string): { code: number; stderr: string } {
  const brief = engine(proj, chat, "aidlc-testing-posture.ts", ["brief", "--stage-level"]);
  expect(brief.code, brief.out).toBe(0);
  const result = spawnSync(BUN, [GUARD], {
    cwd: proj, encoding: "utf-8",
    input: JSON.stringify({
      hook_event_name: "PreToolUse", session_id: chat, cwd: proj, tool_name: "Agent",
      tool_input: { subagent_type: "aidlc-developer-agent", prompt: brief.out },
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: proj, AIDLC_PROJECT_DIR: proj },
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  return { code: result.status ?? -1, stderr: result.stderr ?? "" };
}

/** Bob's own clone of Alice's work; Bob picks it up in a chat of his own. */
function bobsClone(alice: string): string {
  const parent = mkdtempSync(join(tmpdir(), "aidlc-clone-"));
  created.push(parent);
  const bob = join(parent, "bob");
  git(parent, ["clone", "-q", "--no-local", alice, bob]);
  says(bob, "/aidlc carry on", BOB);
  expect(next(bob)).toMatchObject({ kind: "ask", ask_type: "intent-pick" });
  expect(next(bob, ["--pick", PIECE]).kind).toBe("print");
  const switched = spawnSync(BUN, [DISPATCHER, "engine", "intent", "switch", PIECE], {
    cwd: bob, encoding: "utf-8", env: engineEnv(bob, BOB),
  });
  expect(switched.status, switched.stderr).toBe(0);
  return bob;
}

describe("a code plan approved on a five-phase release, on the same checkout", () => {
  test("is still approved: nothing is asked, the answer stays, and the build starts", () => {
    const alice = approvedByAlice();
    receiptsSpelled(alice, (file) => file.replace(SEVEN, FIVE));
    const step = next(alice);
    expect(step, JSON.stringify(step)).toMatchObject({ kind: "run-stage", plan_approval: { status: "approved" } });
    expect(answerLine(alice)).toBe("[Answer]: A. Approve Plan");
    const handed = handoff(alice, ALICE);
    expect(handed.code, handed.stderr).toBe(0);
  });

  test("a receipt naming another questions file is no approval of this plan", () => {
    const alice = approvedByAlice();
    receiptsSpelled(alice, (file) => file.replace(`${SEVEN}code-generation-questions.md`, `${FIVE}other-questions.md`));
    expect(next(alice)).toMatchObject({ kind: "ask", ask_type: "plan-approval" });
  });

  test("a plan changed since is asked about again", () => {
    const alice = approvedByAlice();
    receiptsSpelled(alice, (file) => file.replace(SEVEN, FIVE));
    writePlan(alice, "- [ ] Step 2: also trim the title\n");
    expect(next(alice)).toMatchObject({ kind: "ask", ask_type: "plan-approval" });
  });
});

describe("a code plan approved on a five-phase release, on a teammate's clone", () => {
  test("the approval on record still stands in for the receipt the clone never had", () => {
    const alice = approvedByAlice();
    rowsSpelled(alice, FIVE);
    git(alice, ["add", "-A"]);
    git(alice, ["commit", "-qm", "plan approved"]);
    const bob = bobsClone(alice);
    expect(existsSync(receiptsDir(bob)) ? readdirSync(receiptsDir(bob)).filter((name) => name.startsWith("receipt-")) : [])
      .toEqual([]);
    const step = next(bob);
    expect(step, JSON.stringify(step)).toMatchObject({ kind: "run-stage", plan_approval: { status: "approved" } });
    expect(answerLine(bob)).toBe("[Answer]: A. Approve Plan");
  });

  test("an approval on record for another folder's questions file is asked about", () => {
    const alice = approvedByAlice();
    rowsSpelled(alice, `${RECORD}/construction/other/code-generation/`);
    git(alice, ["add", "-A"]);
    git(alice, ["commit", "-qm", "plan approved"]);
    const bob = bobsClone(alice);
    expect(next(bob)).toMatchObject({ kind: "ask", ask_type: "plan-approval" });
  });
});
