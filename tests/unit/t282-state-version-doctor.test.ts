// covers: subcommand:aidlc-utility:doctor, function:classifyStateVersion, function:bringStateUpToDate, function:inspectStageValidity, function:broughtUpStateText, function:pendingBringUp, function:fivePhaseGraphContract, function:bringUpWaitsOn, function:unwritableFolderFor
//
// The state-version gate and the bring-up beside it. v8 renamed the Inception
// `application-design` stage to `domain-design` and added `contract-design`;
// v10 is the seven-phase layout (Discover through Operate) with the three
// Secure stages added. A v7 record (2.1.x to 2.3.0) and a v8 record (2.6.1 to
// 2.11.4, five phases) are brought up in place the first time the engine reads
// them: the real records those releases wrote (tests/fixtures/state-v7 and
// tests/fixtures/state-v8) resume where they stood, approvals kept, every
// document moved to its seven-phase folder, the original kept beside it, one
// audit row, nothing said; doctor and status show it on purpose. A folder the
// file system will not let move (held open, one this user cannot change, a
// mount in the way) holds the whole bring-up back, said once with what frees
// it, until the next step can make it; doctor and status name a folder this
// user cannot change meanwhile and never promise a step that is held, the
// held attempt keeps no copy, and a kept original is never overwritten. A
// version no step brings up (below 7, 9 from upstream 2.12 team work, newer,
// unparseable) is still refused by `next`, `report` and doctor alike, without
// the old archive-and-start-again advice.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { describe, expect, test, afterEach, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  AIDLC_SRC,
  cleanupTestProject,
  createOrchestrationTestProject,
  REPO_ROOT,
  runOrchestrateNext,
  seededAuditDir,
  seededRecordDir,
  seededStateFile,
} from "../harness/fixtures.ts";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import {
  FIVE_PHASE_CONDITIONS,
  fivePhaseGraphContract,
  sevenPhaseRecordPath,
} from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import { loadGraph } from "../../dist/claude/.claude/tools/aidlc-graph.ts";
import { sevenPhaseStateText } from "../../dist/claude/.claude/tools/aidlc-seven-phase-upgrade.ts";
import { inspectStageValidity, stageValidationAuditFields } from "../../dist/claude/.claude/tools/aidlc-validity.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const BUN = process.execPath;
const UTIL = join(AIDLC_SRC, "tools", "aidlc-utility.ts");

const created: string[] = [];
afterEach(() => {
  while (created.length) cleanupTestProject(created.pop());
});

function stateWithVersion(version: string): string {
  return `# AI-DLC State Tracking

## Project Information
- **Project**: state-version doctor test
- **Project Type**: Greenfield
- **Scope**: feature
- **State Version**: ${version}
- **Skeleton Stance**: on

## Runtime State
- **Revision Count**: 0

## Stage Progress

### INCEPTION PHASE
- [-] domain-design — EXECUTE

## Current Status
- **Lifecycle Phase**: INCEPTION
- **Current Stage**: domain-design
- **Status**: Running
`;
}

function runDoctor(version: string): { status: number; out: string } {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  writeFileSync(seededStateFile(proj), stateWithVersion(version), "utf-8");
  const res = spawnSync(BUN, [UTIL, "doctor", "--verbose", "--project-dir", proj], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    encoding: "utf-8",
    env: { ...process.env },
  });
  return { status: res.status ?? -1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

describe("t282 state-version doctor gate", () => {
  test("a v6 state, which no step brings up, fails the state-version row without archive advice", () => {
    const { status, out } = runDoctor("6");
    expect(out).toMatch(/state version current/);
    expect(out).not.toMatch(/State Version: 8/);
    expect(out).not.toMatch(/State Version: 10/);
    expect(out).not.toContain("mv aidlc");
    expect(out).not.toContain("aidlc-docs");
    // The message explains WHY: no step brings a record that old up, and its rows no longer match.
    expect(out).toMatch(/no step brings a record that old up/);
    expect(out).toMatch(/Finish this workflow on the AI-DLC release that set it up/);
    // It no longer reads as if the v8 rename were the latest change.
    expect(out).not.toMatch(/v8 renamed/);
    expect(status).not.toBe(0);
  });

  test("a v7 state passes the state-version row: AI-DLC's next step brings it up, or names a folder in the way", () => {
    const { out } = runDoctor("7");
    expect(out).toMatch(/State Version: 7 \(AI-DLC's next step brings this record up to 10, or names a folder in the way and what frees it\)/);
    expect(out).not.toMatch(/state version current/);
    expect(out).not.toContain("mv aidlc");
  });

  test("a v8 state (2.6.1 to 2.11.4, five phases) passes the state-version row: AI-DLC's next step brings it up, or names a folder in the way", () => {
    const { out } = runDoctor("8");
    expect(out).toMatch(/State Version: 8 \(AI-DLC's next step brings this record up to 10, or names a folder in the way and what frees it\)/);
    expect(out).not.toMatch(/state version current/);
  });

  test("a current v10 state passes the state-version row", () => {
    const { out } = runDoctor("10");
    expect(out).toMatch(/State Version: 10/);
    expect(out).not.toMatch(/state version current/);
    expect(out).not.toMatch(/brings this record up/);
  });

  // Doctor must classify malformed and future numeric versions the SAME way the
  // runtime guard does (both call the shared classifyStateVersion in aidlc-lib).
  // Malformed values must NOT receive stale-version wording, and future values
  // must receive upgrade guidance (not archive-and-reinit).
  test("a MALFORMED (non-numeric) state fails the readable row, not the past-version row", () => {
    const { status, out } = runDoctor("not-a-number");
    expect(out).toMatch(/state version readable/);
    expect(out).not.toMatch(/state version current/);
    expect(out).toMatch(/missing, empty, or unparseable/);
    expect(status).not.toBe(0);
  });

  test("a FUTURE (v9) state fails the compatible row with the step that carries it on, not archive-and-reinit", () => {
    const { status, out } = runDoctor("9");
    expect(out).toMatch(/state version compatible/);
    expect(out).not.toMatch(/state version current/);
    // The release that wrote it and this install's one step on it, in plain
    // words: no release of this line reads 9, so no update is named.
    expect(out).toContain("This plan was set up with AI-DLC 2.12 team work, which ");
    expect(out).toContain("To carry on");
    expect(out).toContain("the AI-DLC 2.12 release your teammate uses");
    expect(out).not.toMatch(/or newer|aidlc update/);
    expect(out).not.toMatch(/Upgrade the framework|state schema/);
    // The past-version's archive path template ('mv aidlc aidlc.v9-archive')
    // MUST NOT appear — that would be the wrong remediation for a future state.
    expect(out).not.toMatch(/aidlc\.v9-archive/);
    expect(status).not.toBe(0);
  });

  test("a state with TRAILING CONTENT on the version line is unparseable, not v8", () => {
    const { status, out } = runDoctor("8 garbage");
    expect(out).toMatch(/state version readable/);
    expect(out).toMatch(/missing, empty, or unparseable/);
    expect(out).not.toMatch(/State Version: 8/);
    expect(status).not.toBe(0);
  });
});

// The v8 gate must ALSO fire on runtime/mutating commands, not only `doctor`.
// Before the fix, `next` against a v7 state exited 0 with a normal
// load-steering directive and advanced until it hit the removed
// `application-design` row. `next` and `report` must refuse a stale state up
// front with an error directive.
const ORCH = join(AIDLC_SRC, "tools", "aidlc-orchestrate.ts");

function runOrchestrate(sub: string, version: string): { status: number; kind: string; out: string } {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  writeFileSync(seededStateFile(proj), stateWithVersion(version), "utf-8");
  const args = sub === "report"
    ? [ORCH, "report", "--stage", "domain-design", "--result", "approved", "--project-dir", proj]
    : [ORCH, "next", "--project-dir", proj];
  const res = spawnSync(BUN, args, { timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", env: { ...process.env } });
  const out = `${res.stdout ?? ""}`;
  let kind = "";
  try { kind = JSON.parse(out.trim()).kind ?? ""; } catch { kind = ""; }
  return { status: res.status ?? -1, kind, out: `${out}${res.stderr ?? ""}` };
}

function runOrchestrateWithState(sub: string, stateContent: string): { status: number; kind: string; out: string } {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  writeFileSync(seededStateFile(proj), stateContent, "utf-8");
  const args = sub === "report"
    ? [ORCH, "report", "--stage", "domain-design", "--result", "approved", "--project-dir", proj]
    : [ORCH, "next", "--project-dir", proj];
  const res = spawnSync(BUN, args, { timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", env: { ...process.env } });
  const out = `${res.stdout ?? ""}`;
  let kind = "";
  try { kind = JSON.parse(out.trim()).kind ?? ""; } catch { kind = ""; }
  return { status: res.status ?? -1, kind, out: `${out}${res.stderr ?? ""}` };
}

describe("t282 runtime state-version guard (next / report)", () => {
  test("`next` refuses a v6 state, which no step brings up, with an error directive and no archive advice", () => {
    const r = runOrchestrate("next", "6");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(/State Version 6 predates the current/);
    expect(r.out).not.toContain("mv aidlc");
    expect(r.out).not.toMatch(/"kind":\s*"load-steering"/);
  });

  test("`report` refuses a v6 state with an error directive", () => {
    const r = runOrchestrate("report", "6");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(/State Version 6 predates the current/);
  });

  test("`report` on a v7 state brings it up first instead of refusing", () => {
    const r = runOrchestrate("report", "7");
    expect(r.out).not.toMatch(/predates the current/);
  });

  test("a current v10 state is NOT blocked by the runtime guard", () => {
    const r = runOrchestrate("next", "10");
    expect(r.kind).not.toBe("error");
  });

  test("a v8 state is brought up first instead of refusing", () => {
    const r = runOrchestrate("next", "8");
    expect(r.kind).not.toBe("error");
    expect(r.out).not.toMatch(/predates the current/);
  });

  // Runtime must align with `--doctor`, which rejects a state whose version is
  // missing, empty, or unparseable - not only an explicit stale one. Assertions
  // pin the EXACT remediation branch, not generic wording, so a future regression
  // that trips the wrong branch is caught.
  const UNPARSEABLE = /State Version field is missing, empty, or unparseable/;

  test("`next` refuses a state whose State Version field is MISSING (exact unparseable remediation)", () => {
    const stateNoVersion = stateWithVersion("8").replace(
      /^- \*\*State Version\*\*:.*\n/m,
      "",
    );
    const r = runOrchestrateWithState("next", stateNoVersion);
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
    expect(r.out).not.toMatch(/predates the current/);
    expect(r.out).not.toMatch(/"kind":\s*"load-steering"/);
  });

  test("`next` refuses a state whose State Version value is EMPTY (and does not capture the next bullet's `-`)", () => {
    const r = runOrchestrate("next", "");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
    // The `[ \t]*` parser must NOT span the newline and capture "-" from the
    // next state bullet as a bogus version, mislabeling it as a stale version.
    expect(r.out).not.toMatch(/State Version - predates/);
  });

  test("`report` refuses a state whose State Version value is MALFORMED (non-numeric → unparseable)", () => {
    const r = runOrchestrate("report", "not-a-number");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
    expect(r.out).not.toMatch(/predates the current/);
  });

  test("`next` refuses a PRESENT but zero-byte state file (not skipped as absent)", () => {
    const r = runOrchestrateWithState("next", "");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
    expect(r.out).not.toMatch(/"kind":\s*"load-steering"/);
  });

  test("`report` refuses a PRESENT but zero-byte state file", () => {
    const r = runOrchestrateWithState("report", "");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
  });

  // A FUTURE numeric schema (v9) is one this build cannot read, but it does
  // not "predate" v8: a copied project hears the release that wrote it and its
  // own step on it (t-newer-work-update-offer owns every install's line).
  test("`next` on a FUTURE (v9) state names the release that wrote it and the step, not a past-version refusal", () => {
    const r = runOrchestrate("next", "9");
    expect(r.kind).toBe("print");
    expect(r.out).toContain("This plan was set up with AI-DLC 2.12 team work, which ");
    expect(r.out).toContain("get the copy runtime of the AI-DLC 2.12 release your teammate uses");
    expect(r.out).not.toMatch(/or newer|Update and carry on/);
    expect(r.out).not.toMatch(/predates the current|Upgrade the framework/);
  });

  // A parser that captures only the first non-whitespace token accepts anything
  // on the rest of the line, so "State Version: 8 garbage" passed as v8. The
  // anchored parser rejects any trailing content on the schema-token line and
  // routes it through the unparseable branch.
  test("`next` refuses trailing content on the State Version line as unparseable, not as v8", () => {
    const r = runOrchestrate("next", "8 garbage");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
    expect(r.out).not.toMatch(/predates the current/);
    expect(r.out).not.toMatch(/is newer than the current/);
    expect(r.out).not.toMatch(/"kind":\s*"load-steering"/);
  });

  test("`report` refuses trailing content on the State Version line as unparseable", () => {
    const r = runOrchestrate("report", "8 garbage");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
  });

  // A stale numeric with trailing content ("7 archived") must also fall through
  // the unparseable branch rather than being mistaken for a plain v7 state.
  test("`next` treats `7 <trailing>` as unparseable, not as a pre-v8 state", () => {
    const r = runOrchestrate("next", "7 archived");
    expect(r.kind).toBe("error");
    expect(r.out).toMatch(UNPARSEABLE);
    expect(r.out).not.toMatch(/predates the current/);
  });
});

// The past and unparseable refusals point at doctor (a newer state names its own
// step instead). The pointer must name the harness's own
// skill prefix: Codex routes `$aidlc`, so a literal `/aidlc --doctor` sends a
// Codex user to a command their harness does not have.
describe("t282 state-version refusals name doctor through the harness skill prefix", () => {
  const CODEX_ORCH = join(REPO_ROOT, "dist", "codex", ".codex", "tools", "aidlc-orchestrate.ts");
  const nextOn = (tool: string, version: string): string => {
    const proj = createOrchestrationTestProject();
    created.push(proj);
    writeFileSync(seededStateFile(proj), stateWithVersion(version), "utf-8");
    const env = { ...process.env };
    delete env.AIDLC_HARNESS_DIR;
    delete env.AIDLC_HARNESS_NAME;
    const res = spawnSync(BUN, [tool, "next", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
      encoding: "utf-8",
      env,
    });
    return `${res.stdout ?? ""}${res.stderr ?? ""}`;
  };
  for (const [branch, version] of [["past", "6"], ["unparseable", "8 garbage"]]) {
    test(`the ${branch} refusal says $aidlc --doctor on Codex and /aidlc --doctor on Claude`, () => {
      const codex = nextOn(CODEX_ORCH, version);
      expect(codex).toContain("Run `$aidlc --doctor`");
      expect(codex).not.toContain("/aidlc --doctor");
      expect(nextOn(ORCH, version)).toContain("Run `/aidlc --doctor`");
    });
  }
});

// The real records 2.1.x to 2.3.0 wrote (Project Root made relative), brought
// up by main's engine the first time it reads them.
const V7 = join(REPO_ROOT, "tests", "fixtures", "state-v7");
const JUMP = join(AIDLC_SRC, "tools", "aidlc-jump.ts");

function v7Project(fixture: string, withDesign = false): { proj: string; state: string; record: string } {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  const record = seededRecordDir(proj);
  const original = readFileSync(join(V7, fixture), "utf-8");
  writeFileSync(seededStateFile(proj), original, "utf-8");
  if (withDesign) {
    mkdirSync(join(record, "inception"), { recursive: true });
    cpSync(join(V7, "application-design"), join(record, "inception", "application-design"), { recursive: true });
  }
  return { proj, state: original, record };
}

function engine(proj: string, args: string[], env: Record<string, string> = {}): { directive: Record<string, unknown>; out: string } {
  const res = spawnSync(BUN, [ORCH, ...args, "--project-dir", proj], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", env: { ...process.env, ...env },
  });
  const out = `${res.stdout ?? ""}`;
  let directive: Record<string, unknown> = {};
  try { directive = JSON.parse(out.trim()); } catch { directive = {}; }
  return { directive, out: `${out}${res.stderr ?? ""}` };
}

function upgradeRows(proj: string): number {
  const dir = seededAuditDir(proj);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((n, f) => n + (readFileSync(join(dir, f), "utf-8").match(/\*\*Event\*\*: STATE_UPGRADED$/gm)?.length ?? 0), 0);
}

// The one STATE_UPGRADED row, from its heading to the next one.
function upgradeRow(proj: string): string {
  const dir = seededAuditDir(proj);
  const rows = readdirSync(dir).flatMap((f) => readFileSync(join(dir, f), "utf-8").split(/^(?=## )/m))
    .filter((block) => /^\*\*Event\*\*: STATE_UPGRADED$/m.test(block));
  expect(rows.length).toBe(1);
  return rows[0];
}

describe("t282 a v7 record is brought up in place and resumes", () => {
  test("stopped after Application Design was approved (2.3.0): resumes at Units Generation, every approval kept", () => {
    const { proj, state, record } = v7Project("aidlc-state-2.3.0-design-approved.md", true);
    const r = engine(proj, ["next", "--resume"]);
    expect(r.out).not.toMatch(/predates the current/);
    expect(r.directive.kind).not.toBe("error");
    expect(r.directive.stage).toBe("units-generation");
    const now = readFileSync(seededStateFile(proj), "utf-8");
    // 7 to 8 to 10 in one pass.
    expect(now).toMatch(/^- \*\*State Version\*\*: 10$/m);
    for (const slug of ["practices-discovery", "requirements-analysis", "user-stories", "refined-mockups", "domain-design"]) {
      expect(now).toMatch(new RegExp(`^- \\[x\\] ${slug} \u2014 EXECUTE$`, "m"));
    }
    expect(now).not.toMatch(/application-design/);
    expect(now).toMatch(/^- \*\*Last Completed Stage\*\*: domain-design$/m);
    // The route after Units Generation runs through Contract Design now, and status reads this field.
    expect(now).toMatch(/^- \*\*Next Stage\*\*: contract-design$/m);
    // Contract Design has no row until the work moves onto it, as for any stage a newer release adds.
    expect(now).not.toMatch(/^- \[.\] contract-design/m);
    // The approved design is where Units Generation reads it.
    expect(existsSync(join(record, "design", "domain-design", "components.md"))).toBe(true);
    expect(existsSync(join(record, "inception", "application-design"))).toBe(false);
    expect(readFileSync(join(record, "aidlc-state.v7.md"), "utf-8")).toBe(state);
    // One copy, the record as 2.3.0 wrote it: the 8 it passed through was never on disk.
    expect(existsSync(join(record, "aidlc-state.v8.md"))).toBe(false);
    expect(upgradeRows(proj)).toBe(1);
    const row = upgradeRow(proj);
    expect(row).toMatch(/^\*\*From\*\*: 7$/m);
    expect(row).toMatch(/^\*\*To\*\*: 10$/m);
    expect(row).toMatch(/^\*\*Original\*\*: aidlc-state\.v7\.md$/m);
    expect(row).toMatch(/^\*\*Stages added\*\*: contract-design, code-review, security-review, conformance-review$/m);
    expect(row).toMatch(/^\*\*Moved\*\*: inception\/application-design to design\/domain-design$/m);
    // The seven-phase layout, with the Secure rows the 8 step writes.
    expect(now).toMatch(/^### DESIGN PHASE\nPer unit: \[TBD\]$/m);
    expect(now).not.toMatch(/^### (IDEATION|INCEPTION|CONSTRUCTION|OPERATION) PHASE$/m);
    expect(now).toMatch(/^- \[ \] code-review \u2014 EXECUTE$/m);
    expect(now).toMatch(/^- \*\*Lifecycle Phase\*\*: DESIGN$/m);
    // A second step finds it current: nothing more is written.
    engine(proj, ["next", "--resume"]);
    expect(upgradeRows(proj)).toBe(1);
    expect(readFileSync(join(record, "aidlc-state.v7.md"), "utf-8")).toBe(state);
  });

  test("stopped right after Units Generation was approved (2.1.7): Contract Design runs next, by the engine's own backward jump", () => {
    const { proj } = v7Project("aidlc-state-2.1.7-units-approved.md");
    // The 2.1.7 audit holds no STAGE_STARTED for Delivery Planning here, so every add
    // since the record began counts; the bring-up row is the only one.
    const r = engine(proj, ["next"]);
    const message = String(r.directive.message ?? "");
    expect(r.directive.kind).toBe("print");
    expect(message).toMatch(/--target contract-design --direction backward/);
    const jump = spawnSync(BUN, [JUMP, "execute", "--target", "contract-design", "--direction", "backward", "--scope", "workshop"], {
      cwd: proj, timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
    });
    expect(jump.status, `${jump.stdout}${jump.stderr}`).toBe(0);
    const now = readFileSync(seededStateFile(proj), "utf-8");
    expect(now).toMatch(/^- \[-\] contract-design \u2014 EXECUTE$/m);
    expect(now).toMatch(/^- \*\*Current Stage\*\*: contract-design$/m);
    expect(now).toMatch(/^- \[x\] units-generation \u2014 EXECUTE$/m);
    expect(now).toMatch(/^- \[x\] domain-design \u2014 EXECUTE$/m);
    expect(engine(proj, ["next"]).directive.stage).toBe("contract-design");
  });

  test("already in Code Generation (2.1.1): it carries on there and nothing approved is reopened", () => {
    const { proj } = v7Project("aidlc-state-2.1.1-code-generation.md");
    const r = engine(proj, ["next", "--resume"]);
    expect(r.directive.kind).not.toBe("error");
    expect(r.out).not.toMatch(/contract-design/);
    const now = readFileSync(seededStateFile(proj), "utf-8");
    expect(now).toMatch(/^- \*\*Current Stage\*\*: code-generation$/m);
    expect(now).toMatch(/^- \[x\] domain-design \u2014 EXECUTE$/m);
    expect(now).toMatch(/^- \[x\] delivery-planning \u2014 EXECUTE$/m);
  });

  test("a current v10 record is untouched: same bytes, no copy, no audit row", () => {
    const proj = createOrchestrationTestProject();
    created.push(proj);
    const v10 = stateWithVersion("10");
    writeFileSync(seededStateFile(proj), v10, "utf-8");
    engine(proj, ["next"]);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(v10);
    expect(existsSync(join(seededRecordDir(proj), "aidlc-state.v10.md"))).toBe(false);
    expect(upgradeRows(proj)).toBe(0);
  });

  test("a hand-written v8 record is no longer left as it was: it is brought up to 10, the original kept beside it", () => {
    const proj = createOrchestrationTestProject();
    created.push(proj);
    const v8 = stateWithVersion("8");
    writeFileSync(seededStateFile(proj), v8, "utf-8");
    engine(proj, ["next"]);
    const now = readFileSync(seededStateFile(proj), "utf-8");
    expect(now).toMatch(/^- \*\*State Version\*\*: 10$/m);
    // Its Stage Progress has no checkbox comment, so it is left as written, rows and all.
    expect(now).toMatch(/^- \[-\] domain-design \u2014 EXECUTE$/m);
    expect(now).toMatch(/^- \*\*Lifecycle Phase\*\*: DESIGN$/m);
    expect(readFileSync(join(seededRecordDir(proj), "aidlc-state.v8.md"), "utf-8")).toBe(v8);
    expect(upgradeRows(proj)).toBe(1);
  });

  test("the Stop hook's read-only probe on a v7 record writes nothing", () => {
    const { proj, state, record } = v7Project("aidlc-state-2.3.0-design-approved.md", true);
    engine(proj, ["next"], { AIDLC_STOP_HOOK_PROBE: "1" });
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
    expect(existsSync(join(record, "aidlc-state.v7.md"))).toBe(false);
    expect(existsSync(join(record, "inception", "application-design", "components.md"))).toBe(true);
    expect(upgradeRows(proj)).toBe(0);
  });

  test("a folder already at the new name is kept as it is, and the old folder is never deleted", () => {
    const { proj, record } = v7Project("aidlc-state-2.3.0-design-approved.md", true);
    mkdirSync(join(record, "design", "domain-design"), { recursive: true });
    writeFileSync(join(record, "design", "domain-design", "components.md"), "already here\n", "utf-8");
    engine(proj, ["next", "--resume"]);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expect(readFileSync(join(record, "design", "domain-design", "components.md"), "utf-8")).toBe("already here\n");
    expect(existsSync(join(record, "inception", "application-design", "components.md"))).toBe(true);
  });

  // Linux renames a folder this user cannot write in place, since only a new
  // parent changes its ".." entry: the sensor folder's rename keeps its
  // parent, so doctor and status do not call the record waiting on it. Root,
  // whom no mode bit stops, cannot stand in for that user.
  test.skipIf(process.platform !== "linux" || process.getuid?.() === 0)("a sensor folder this user cannot write, renamed in place, keeps nothing waiting: doctor, status and the step agree", () => {
    const { proj, record } = v7Project("aidlc-state-2.3.0-design-approved.md", true);
    const sensors = join(record, ".aidlc-sensors");
    mkdirSync(join(sensors, "application-design"), { recursive: true });
    writeFileSync(join(sensors, "application-design", "result.json"), "{}\n", "utf-8");
    chmodSync(join(sensors, "application-design"), 0o555);
    let doctor = "";
    let status = "";
    let step: { directive: Record<string, unknown>; out: string } = { directive: {}, out: "" };
    try {
      doctor = doctorOf(proj);
      status = statusOf(proj);
      step = engine(proj, ["next", "--resume"]);
    } finally {
      for (const slug of ["application-design", "domain-design"]) {
        if (existsSync(join(sensors, slug))) chmodSync(join(sensors, slug), 0o755);
      }
    }
    expect(doctor).not.toMatch(/cannot bring this record up|application-design/);
    expect(doctor).toContain(
      "State Version: 7 (AI-DLC's next step brings this record up to 10, or names a folder in the way and what frees it)",
    );
    expect(status).not.toMatch(/^Brought up: +waiting/m);
    expect(status).toMatch(/^Brought up: +at AI-DLC's next step,/m);
    // The step makes the rename doctor said it would.
    expect(step.directive.stage).toBe("units-generation");
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expect(readFileSync(join(sensors, "domain-design", "result.json"), "utf-8")).toBe("{}\n");
    expect(existsSync(join(sensors, "application-design"))).toBe(false);
  });

  // A rename whose new folder is already there is never made (the old one is
  // kept), so a folder it would move keeps nothing waiting, whoever owns it.
  test.skipIf(process.platform === "win32")("a sensor folder whose new name is already there keeps nothing waiting, however it is locked", () => {
    const { proj, record } = v7Project("aidlc-state-2.3.0-design-approved.md", true);
    const sensors = join(record, ".aidlc-sensors");
    for (const slug of ["application-design", "domain-design"]) mkdirSync(join(sensors, slug), { recursive: true });
    const unlock = lockFolder(join(sensors, "application-design"));
    let doctor = "";
    let status = "";
    let step: { directive: Record<string, unknown>; out: string } = { directive: {}, out: "" };
    try {
      doctor = doctorOf(proj);
      status = statusOf(proj);
      step = engine(proj, ["next", "--resume"]);
    } finally {
      unlock();
    }
    expect(doctor).not.toMatch(/cannot bring this record up/);
    expect(status).not.toMatch(/^Brought up: +waiting/m);
    expect(step.directive.stage).toBe("units-generation");
    expect(existsSync(join(sensors, "application-design"))).toBe(true);
  });

  test("after the step, doctor and status say when it was brought up", () => {
    const { proj } = v7Project("aidlc-state-2.3.0-design-approved.md", true);
    engine(proj, ["next", "--resume"]);
    const doctor = spawnSync(BUN, [UTIL, "doctor", "--verbose", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(`${doctor.stdout}`).toMatch(/State Version: 10 \(brought up from 7 on \d{4}-\d{2}-\d{2}; the record as it was is aidlc-state\.v7\.md\)/);
    const status = spawnSync(BUN, [UTIL, "status", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(`${status.stdout}`).toMatch(/^Brought up: +from an older AI-DLC on \d{4}-\d{2}-\d{2} \(the record as it was: aidlc-state\.v7\.md\)$/m);
    expect(`${status.stdout}`).toMatch(/^Next Stage: +Contract Design$/m);
  });
});

// Real records 2.11.4 wrote (State Version 8, five phases), made by driving
// that release's own engine and state tool, with the record folder named as
// the test project's: an open gate in Inception, a solo Unit walk partway
// through its first Unit, the same walk with its Units named like stages
// (code-review, then incident-response), one whose first Unit is named like CI
// Pipeline with that stage finished, and work in Operation. Each holds its
// stage documents, its review records and its audit as 2.11.4 left them.
const V8 = join(REPO_ROOT, "tests", "fixtures", "state-v8");
const SECURE = ["code-review", "security-review", "conformance-review"];
const FIVE_PHASE_FOLDERS = ["ideation", "inception", "construction", "operation"];
// The fixture audits hold stage events and no hook heartbeat from this test
// project, which the engine reads as hooks that never ran.
const V8_ENV = { AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" };

function v8Project(fixture: string): { proj: string; state: string; record: string; documents: Map<string, string> } {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  const record = seededRecordDir(proj);
  cpSync(join(V8, fixture), record, { recursive: true });
  // 2.11.4 makes every phase folder at creation; git keeps no empty folder.
  for (const folder of ["initialization", ...FIVE_PHASE_FOLDERS, "verification"]) mkdirSync(join(record, folder), { recursive: true });
  return { proj, state: readFileSync(seededStateFile(proj), "utf-8"), record, documents: stageDocuments(record) };
}

// Every file under the record's phase folders, by record-relative path.
function stageDocuments(record: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.set(relative(record, path).split("\\").join("/"), readFileSync(path, "utf-8"));
    }
  };
  for (const entry of readdirSync(record, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "audit" && !entry.name.startsWith(".")) walk(join(record, entry.name));
  }
  return out;
}

// Makes `dir` a folder this user cannot change, as one another user or a
// container made is: read-only to its owner, and immutable for root, whom no
// mode bit stops. Returns the step that frees it again.
function lockFolder(dir: string): () => void {
  if (process.getuid?.() !== 0) {
    chmodSync(dir, 0o555);
    return () => chmodSync(dir, 0o755);
  }
  const locked = spawnSync("chattr", ["+i", dir], { encoding: "utf-8" });
  expect(locked.status, `chattr +i: ${locked.stderr}`).toBe(0);
  return () => {
    spawnSync("chattr", ["-i", dir]);
  };
}

function v8Next(proj: string, args: string[] = [], env: Record<string, string> = {}) {
  return runOrchestrateNext(ORCH, proj, args, { env: { ...process.env, ...V8_ENV, ...env } });
}

// Every document 2.11.4 wrote is where the seven-phase layout keeps it, as it
// was, and nothing else is there.
function expectDocumentsMoved(record: string, before: Map<string, string>): void {
  const after = stageDocuments(record);
  const expected = new Map([...before].map(([path, text]) => [sevenPhaseRecordPath(path), text]));
  expect([...after.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [path, text] of expected) expect(after.get(path), path).toBe(text);
  for (const folder of FIVE_PHASE_FOLDERS) expect(existsSync(join(record, folder)), folder).toBe(false);
  expect(existsSync(join(record, "initialization"))).toBe(true);
}

function expectSevenPhaseHeadings(state: string): void {
  const headings = [...state.matchAll(/^### (.*) PHASE$/gm)].map((m) => m[1]);
  expect(headings).toEqual(["INITIALIZATION", "DISCOVER", "DESIGN", "BUILD", "TEST", "SECURE", "DEPLOY", "OPERATE"]);
}

// Every STATE_UPGRADED row, in the order the audit holds them.
function upgradeRowBlocks(proj: string): string[] {
  const dir = seededAuditDir(proj);
  return readdirSync(dir).sort().flatMap((f) => readFileSync(join(dir, f), "utf-8").split(/^(?=## )/m))
    .filter((block) => /^\*\*Event\*\*: STATE_UPGRADED$/m.test(block));
}

// Puts a brought-up record back for 2.11.4 by hand, as the guide says: the
// kept copy back as the state (copied, as the guide once said, or moved), and
// every folder the latest row lists under Moved back where it came from.
function putBackByHand(proj: string, record: string, kept: "copy" | "move"): void {
  const moved = /^\*\*Moved\*\*: (.*)$/m.exec(upgradeRowBlocks(proj).at(-1) ?? "")?.[1] ?? "";
  for (const move of moved.split(", ")) {
    const [from, to] = move.split(" to ");
    mkdirSync(dirname(join(record, ...from.split("/"))), { recursive: true });
    renameSync(join(record, ...to.split("/")), join(record, ...from.split("/")));
  }
  for (const folder of ["discover", "design", "build", "test", "secure", "deploy", "operate"]) {
    const dir = join(record, folder);
    if (existsSync(dir) && !readdirSync(dir, { recursive: true, withFileTypes: true }).some((entry) => entry.isFile())) {
      rmSync(dir, { recursive: true });
    }
  }
  const original = join(record, "aidlc-state.v8.md");
  if (kept === "copy") cpSync(original, seededStateFile(proj));
  else renameSync(original, seededStateFile(proj));
}

function phaseProgress(state: string): string[] {
  return [...state.matchAll(/^- \*\*(\w+)\*\*: (Pending|Active|Verified|Skipped)$/gm)].map((m) => `${m[1]} ${m[2]}`);
}

describe("t282 a v8 record (2.11.4, five phases) is brought up to 10 in place and resumes", () => {
  test("an open gate in Inception: the state reads as seven phases, every document moves to its folder, and the gate stays where it stood", () => {
    const { proj, state, record, documents } = v8Project("inception-gate");
    expect(documents.has("inception/requirements-analysis/requirements.md")).toBe(true);
    const r = v8Next(proj);
    expect(r.out).not.toMatch(/predates the current|newer AI-DLC/);
    const now = readFileSync(seededStateFile(proj), "utf-8");
    expect(now).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expectSevenPhaseHeadings(now);
    // Every row keeps its mark and plan action, the open gate included, in the current order.
    expect(now).toMatch(/^### DISCOVER PHASE\n- \[x\] intent-capture \u2014 EXECUTE\n- \[x\] market-research \u2014 EXECUTE\n- \[x\] feasibility \u2014 EXECUTE\n- \[ \] reverse-engineering \u2014 SKIP\n- \[x\] scope-definition \u2014 EXECUTE$/m);
    expect(now).toMatch(/^### DESIGN PHASE\n- \[x\] practices-discovery \u2014 EXECUTE\n- \[\?\] requirements-analysis \u2014 EXECUTE$/m);
    expect(now).toMatch(/^### TEST PHASE\n- \[ \] build-and-test \u2014 EXECUTE\n- \[ \] performance-validation \u2014 EXECUTE$/m);
    // The Secure rows, with the action feature routes a stage with no row by.
    expect(now).toMatch(/^### SECURE PHASE\n- \[ \] code-review \u2014 EXECUTE\n- \[ \] security-review \u2014 EXECUTE\n- \[ \] conformance-review \u2014 SKIP$/m);
    expect(now).toMatch(/^### DEPLOY PHASE\n- \[ \] ci-pipeline \u2014 EXECUTE\n- \[ \] deployment-pipeline/m);
    expect(phaseProgress(now)).toEqual([
      "Initialization Verified", "Discover Verified", "Design Active", "Build Pending",
      "Test Pending", "Secure Pending", "Deploy Pending", "Operate Pending",
    ]);
    expect(now).toMatch(/^- \*\*Lifecycle Phase\*\*: DESIGN$/m);
    expect(now).toMatch(/^- \*\*Current Stage\*\*: requirements-analysis$/m);
    expect(now).toMatch(/^- \*\*Next Stage\*\*: user-stories$/m);
    // The plan fields in this graph's numbers; the greenfield note byte for byte.
    expect(now).toMatch(/^- \*\*Stages to Skip\*\*: 1\.4 \(reverse-engineering \u2014 greenfield\), 5\.3 \(conformance-review\)$/m);
    expect(now).toMatch(/^- \*\*Stages to Execute\*\*: 0\.1 \(workspace-scaffold\), .*1\.5 \(scope-definition\), .*2\.2 \(requirements-analysis\), .*4\.2 \(performance-validation\), 5\.1 \(code-review\), 5\.2 \(security-review\), 6\.1 \(ci-pipeline\), .*7\.3 \(feedback-optimization\)$/m);
    expect(now).toMatch(/^- \*\*Total Stages\*\*: 34$/m);
    expect(now).toMatch(/^- \*\*Completed\*\*: 11$/m);
    expect(now).not.toMatch(/IDEATION|INCEPTION|CONSTRUCTION|OPERATION|\*\*Ideation\*\*|\*\*Inception\*\*/);
    expectDocumentsMoved(record, documents);
    expect(readFileSync(join(record, "design", "requirements-analysis", "requirements.md"), "utf-8"))
      .toBe(documents.get("inception/requirements-analysis/requirements.md") ?? "missing from the fixture");
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(state);
    const row = upgradeRow(proj);
    expect(row).toMatch(/^\*\*From\*\*: 8$/m);
    expect(row).toMatch(/^\*\*To\*\*: 10$/m);
    expect(row).toMatch(/^\*\*Stages added\*\*: code-review, security-review, conformance-review$/m);
    expect(row).toMatch(/^\*\*Moved\*\*: .*ideation\/intent-capture to discover\/intent-capture, .*inception\/requirements-analysis to design\/requirements-analysis$/m);
    expect(row).toMatch(/^\*\*Left behind\*\*: none$/m);
    expect(row).toMatch(/^\*\*Original\*\*: aidlc-state\.v8\.md$/m);
    // next shows the gate 2.11.4 left open, as 2.11.4 does: its review still
    // holds at the moved paths, no finished stage reads as changed, and it
    // never moves on past it.
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("requirements-analysis");
    expect(r.directive?.gate).toBe(true);
    expect(r.directive?.stage_validity).toBeUndefined();
    expect(JSON.stringify(r.directive)).not.toContain("user-stories");
    expect(now).toMatch(/^- \[\?\] requirements-analysis \u2014 EXECUTE$/m);
    // A second read finds it current: nothing more moves or is written for the step.
    const second = v8Next(proj);
    expect(second.directive?.kind).toBe(r.directive?.kind);
    expect(upgradeRows(proj)).toBe(1);
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(state);
    expectDocumentsMoved(record, documents);
  });

  test("mid Unit walk: each Unit's folders split into design/<unit>/ and build/<unit>/, and the walk carries on at the same Unit and stage", () => {
    const { proj, record, documents } = v8Project("unit-walk");
    expect(documents.has("construction/store/code-generation/code-generation-plan.md")).toBe(true);
    const r = v8Next(proj);
    // 2.11.4 routes this record to the store Unit's Code Generation; so does this one.
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("code-generation");
    expect(r.directive?.unit).toBe("store");
    // Every stage and Unit finished on 2.11.4 still holds at its moved paths.
    expect(r.directive?.stage_validity).toBeUndefined();
    const now = readFileSync(seededStateFile(proj), "utf-8");
    expect(now).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expectSevenPhaseHeadings(now);
    // The walk keeps Current Stage on the block's first stage, in Design now.
    expect(now).toMatch(/^- \*\*Lifecycle Phase\*\*: DESIGN$/m);
    expect(now).toMatch(/^- \*\*Current Stage\*\*: functional-design$/m);
    expect(now).toMatch(/^- \*\*Active Unit\*\*: store$/m);
    expect(now).toMatch(/^- \*\*Unit Stage\*\*: code-generation$/m);
    expect(now).toMatch(/^- \[x\] delivery-planning \u2014 EXECUTE\n- \[-\] functional-design \u2014 EXECUTE\n- \[ \] nfr-requirements \u2014 EXECUTE$/m);
    expect(now).toMatch(/^### BUILD PHASE\n- \[ \] code-generation \u2014 EXECUTE$/m);
    expect(phaseProgress(now)).toEqual([
      "Initialization Verified", "Discover Verified", "Design Active", "Build Pending",
      "Test Pending", "Secure Pending", "Deploy Pending", "Operate Pending",
    ]);
    expectDocumentsMoved(record, documents);
    expect(existsSync(join(record, "design", "store", "functional-design", "functional-spec.md"))).toBe(true);
    expect(existsSync(join(record, "design", "store", "infrastructure-design", "traceability.json"))).toBe(true);
    expect(existsSync(join(record, "build", "store", "code-generation", "code-generation-plan.md"))).toBe(true);
    expect(existsSync(join(record, "design", "units-generation", "unit-of-work-dependency.md"))).toBe(true);
    const row = upgradeRow(proj);
    expect(row).toMatch(/construction\/store\/functional-design to design\/store\/functional-design/);
    expect(row).toMatch(/construction\/store\/code-generation to build\/store\/code-generation/);
    expect(row).toMatch(/^\*\*Left behind\*\*: none$/m);
  });

  test("in Operation: Reverse Engineering moves to discover/, Build and Test to test/, the deployments to deploy/, and the stage carries on", () => {
    const { proj, record, documents } = v8Project("operation");
    const r = v8Next(proj);
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("observability-setup");
    // Every stage finished on 2.11.4 still holds at its moved paths. Reverse
    // Engineering's documents live in the space's code knowledge base under
    // the project's own folder name, outside the record, so a record copied
    // into another project cannot carry them and only that stage reads as
    // changed here, as it would on 2.11.4.
    const validity = r.directive?.stage_validity as { directly_stale?: string[]; needs_revalidation?: string[] } | undefined;
    expect(validity?.directly_stale).toEqual(["reverse-engineering"]);
    expect(validity?.needs_revalidation).toEqual([]);
    const now = readFileSync(seededStateFile(proj), "utf-8");
    expect(now).toMatch(/^- \*\*Lifecycle Phase\*\*: OPERATE$/m);
    expect(now).toMatch(/^### OPERATE PHASE\n- \[-\] observability-setup \u2014 EXECUTE$/m);
    // Express runs the two Secure reviews; work already past them does not go back to them.
    expect(now).toMatch(/^### SECURE PHASE\n- \[ \] code-review \u2014 EXECUTE\n- \[ \] security-review \u2014 EXECUTE\n- \[ \] conformance-review \u2014 SKIP$/m);
    expect(phaseProgress(now)).toEqual([
      "Initialization Verified", "Discover Verified", "Design Verified", "Build Verified",
      "Test Verified", "Secure Skipped", "Deploy Verified", "Operate Active",
    ]);
    expect(now).toMatch(/^- \*\*Completed\*\*: 9$/m);
    expectDocumentsMoved(record, documents);
    for (const path of [
      "discover/reverse-engineering/developer-scan.md",
      "build/code-generation/code-generation-plan.md",
      "test/build-and-test/build-test-results.md",
      "deploy/deployment-pipeline/rollback-runbook.md",
      "deploy/deployment-execution/deployment-log.md",
      "operate/observability-setup/dashboards.md",
    ]) expect(existsSync(join(record, ...path.split("/"))), path).toBe(true);
  });

  test("a document edited after the move still reads as changed: only the recorded paths are read in their seven-phase form", () => {
    const { proj, record } = v8Project("inception-gate");
    expect(v8Next(proj).directive?.stage_validity).toBeUndefined();
    const inspect = () => inspectStageValidity(proj, readFileSync(seededStateFile(proj), "utf-8"));
    expect(inspect().issues).toEqual([]);
    // Feature runs with Guard Policy off, which accepts an edit to a finished
    // document, so next says nothing; the receipt check itself still sees it.
    const statement = join(record, "discover", "intent-capture", "intent-statement.md");
    writeFileSync(statement, `${readFileSync(statement, "utf-8")}\nA line added after the update.\n`);
    const issue = inspect().issues.find((entry) => entry.stage === "intent-capture");
    expect(issue).toMatchObject({ status: "stale", direct: true, reasons: ["output:intent-statement"], edited: true });
  });

  test("the text step is the same on CRLF, on a record a hook already gave a seven-phase Lifecycle Phase, and on its own output", () => {
    const { state } = v8Project("inception-gate");
    const once = sevenPhaseStateText(state, SECURE);
    expect(sevenPhaseStateText(once, SECURE)).toBe(once);
    expect(sevenPhaseStateText(state.replace(/^(- \*\*Lifecycle Phase\*\*:) INCEPTION$/m, "$1 DESIGN"), SECURE)).toBe(once);
    const crlf = sevenPhaseStateText(state.replaceAll("\n", "\r\n"), SECURE);
    expect(crlf).toBe(once.replaceAll("\n", "\r\n"));
  });

  test("a folder the move would overwrite is left where it was, named in the audit row and by doctor with its move", () => {
    const { proj, record, documents } = v8Project("inception-gate");
    mkdirSync(join(record, "design", "requirements-analysis"), { recursive: true });
    writeFileSync(join(record, "design", "requirements-analysis", "requirements.md"), "already here\n", "utf-8");
    v8Next(proj);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expect(readFileSync(join(record, "design", "requirements-analysis", "requirements.md"), "utf-8")).toBe("already here\n");
    expect(readFileSync(join(record, "inception", "requirements-analysis", "requirements.md"), "utf-8"))
      .toBe(documents.get("inception/requirements-analysis/requirements.md") ?? "missing from the fixture");
    // The rest of the stage's folder joined the one already there; nothing else was left.
    expect(existsSync(join(record, "design", "requirements-analysis", "requirements-analysis-questions.md"))).toBe(true);
    expect(existsSync(join(record, "inception", "requirements-analysis", "requirements-analysis-questions.md"))).toBe(false);
    expect(existsSync(join(record, "ideation"))).toBe(false);
    expect(upgradeRow(proj)).toMatch(/^\*\*Left behind\*\*: inception\/requirements-analysis\/requirements\.md$/m);
    const doctor = spawnSync(BUN, [UTIL, "doctor", "--verbose", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    const out = `${doctor.stdout}${doctor.stderr}`;
    expect(out).toMatch(/State Version: 10 \(brought up from 8 on \d{4}-\d{2}-\d{2}; the record as it was is aidlc-state\.v8\.md\)/);
    expect(out).toMatch(/Left where an earlier AI-DLC kept it, and not read there now: aidlc\/spaces\/default\/intents\/[^/\s]+\/inception\/requirements-analysis/);
    expect(out).toMatch(/move what aidlc\/spaces\/default\/intents\/[^/\s]+\/inception\/requirements-analysis holds into aidlc\/spaces\/default\/intents\/[^/\s]+\/design\/requirements-analysis/);
  });

  test("the Stop hook's read-only probe on a v8 record moves and writes nothing", () => {
    const { proj, state, record, documents } = v8Project("unit-walk");
    v8Next(proj, [], { AIDLC_STOP_HOOK_PROBE: "1" });
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
    expect(existsSync(join(record, "aidlc-state.v8.md"))).toBe(false);
    expect(stageDocuments(record)).toEqual(documents);
    expect(upgradeRows(proj)).toBe(0);
  });

  test("a Unit named like a stage is still a Unit: its folders split into design/<unit>/ and build/<unit>/, and the walk carries on at its Code Generation", () => {
    // 2.11.4 lets a Unit take a stage's name: here code-review (a stage it did
    // not ship), with incident-response (one of its Operation stages) next.
    const { proj, record, documents } = v8Project("units-named-like-stages");
    expect(documents.has("construction/code-review/code-generation/code-generation-plan.md")).toBe(true);
    const r = v8Next(proj);
    // 2.11.4 routes this record to the code-review Unit's Code Generation; so does this one.
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("code-generation");
    expect(r.directive?.unit).toBe("code-review");
    expect(r.directive?.stage_validity).toBeUndefined();
    expectDocumentsMoved(record, documents);
    expect(existsSync(join(record, "design", "code-review", "functional-design", "functional-spec.md"))).toBe(true);
    expect(existsSync(join(record, "build", "code-review", "code-generation", "code-generation-plan.md"))).toBe(true);
    expect(existsSync(join(record, "secure"))).toBe(false);
    const row = upgradeRow(proj);
    expect(row).toMatch(/construction\/code-review\/functional-design to design\/code-review\/functional-design/);
    expect(row).toMatch(/construction\/code-review\/code-generation to build\/code-review\/code-generation/);
    expect(row).toMatch(/^\*\*Left behind\*\*: none$/m);
  });

  test("a folder the file system will not let move holds the bring-up back: nothing asked or routed, the folder named once, and the next step makes the whole move", () => {
    const { proj, state, record, documents } = v8Project("inception-gate");
    const held = v8Next(proj, [], { AIDLC_TEST: "1", AIDLC_TEST_FOLDER_MOVE_FAIL: "inception/requirements-analysis" });
    // One line for the person, and the turn ends: no stage, gate or question.
    expect(held.directive?.kind).toBe("print");
    const message = String(held.directive?.message ?? "");
    expect(message).toMatch(/^Tell the person in one line: "AI-DLC could not move `aidlc\/spaces\/default\/intents\/[^/`]+\/inception\/requirements-analysis` to `aidlc\/spaces\/default\/intents\/[^/`]+\/design\/requirements-analysis`, where this release keeps it: /);
    expect(message).toContain("Your work is as it was.");
    expect(message).toMatch(/\b[Tt]hen ask me to carry on, and AI-DLC finishes moving your work and picks up where you were\./);
    expect(message).not.toMatch(/State Version|STATE_UPGRADED|EBUSY|stage_validity/);
    if (process.platform === "win32") {
      expect(message).toContain(": a program on this computer has that folder open. Your work is as it was. Close what has it open (");
    } else {
      // A Linux or macOS drive of its own refuses no open folder, so EBUSY
      // there is also a folder something is mounted on, which no program's
      // closing frees: the line names both, and the move by hand for a mount.
      expect(message).toContain(
        ": a program on this computer has that folder open, or something is mounted there (a container's volume or " +
          "a network drive). Your work is as it was. Close what has it open (",
      );
      expect(message).toMatch(/; if nothing has it open, move what is in it to `aidlc\/spaces\/default\/intents\/[^/`]+\/design\/requirements-analysis` yourself\. Then ask me to carry on/);
      expect(message).not.toMatch(/unmount/);
    }
    // The record is as 2.11.4 left it: still State Version 8, every document where it was, no audit row.
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
    expect(stageDocuments(record)).toEqual(documents);
    for (const folder of ["discover", "design"]) expect(existsSync(join(record, folder)), folder).toBe(false);
    expect(upgradeRows(proj)).toBe(0);
    // Once nothing holds it, the next step brings the record up whole and shows the open gate, as 2.11.4 does.
    const r = v8Next(proj);
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("requirements-analysis");
    expect(r.directive?.gate).toBe(true);
    expect(r.directive?.stage_validity).toBeUndefined();
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expectDocumentsMoved(record, documents);
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(state);
    // Its one row lists every move, the ones the held attempt had made too.
    const row = upgradeRow(proj);
    const moves = [
      ...["approval-handoff", "feasibility", "intent-capture", "market-research", "rough-mockups", "scope-definition", "team-formation"]
        .map((slug) => `ideation/${slug} to discover/${slug}`),
      "inception/practices-discovery to design/practices-discovery",
      "inception/requirements-analysis to design/requirements-analysis",
    ];
    expect(row).toContain(`\n**Moved**: ${moves.join(", ")}\n`);
    expect(row).toMatch(/^\*\*Left behind\*\*: none$/m);
  });

  test("a Unit named like CI Pipeline, with CI Pipeline finished: the stage's own documents go where it reads them, and nothing reads as changed", () => {
    // 2.11.4 kept the ci-pipeline Unit's stages and CI Pipeline's own
    // documents in the one folder construction/ci-pipeline/.
    const { proj, record, documents } = v8Project("unit-named-ci-pipeline");
    expect(documents.has("construction/ci-pipeline/ci-config.md")).toBe(true);
    expect(documents.has("construction/ci-pipeline/functional-design/functional-spec.md")).toBe(true);
    const r = v8Next(proj);
    expect(r.directive?.stage_validity).toBeUndefined();
    expect(r.out).not.toMatch(CHANGED_LINES);
    expectDocumentsMoved(record, documents);
    for (const file of ["ci-config.md", "ci-pipeline-questions.md", "quality-gates.md"]) {
      expect(existsSync(join(record, "deploy", "ci-pipeline", file)), file).toBe(true);
    }
    expect(existsSync(join(record, "design", "ci-pipeline", "functional-design", "functional-spec.md"))).toBe(true);
    expect(existsSync(join(record, "build", "ci-pipeline", "code-generation", "code-generation-plan.md"))).toBe(true);
    expect(upgradeRow(proj)).toMatch(/^\*\*Left behind\*\*: none$/m);
    for (const out of [statusOf(proj), doctorOf(proj)]) expect(out).not.toMatch(CHANGED_LINES);
  });

  test("a held attempt keeps no copy: work paused meanwhile is kept once, under the plain name, as it stood when it was brought up", () => {
    const { proj, state, record } = v8Project("inception-gate");
    const kept = () => readdirSync(record).filter((name) => /^aidlc-state\.v\d/.test(name)).sort();
    v8Next(proj, [], { AIDLC_TEST: "1", AIDLC_TEST_FOLDER_MOVE_FAIL: "inception/requirements-analysis" });
    expect(kept()).toEqual([]);
    // Meanwhile the person stops for the day, which the record keeps at State Version 8.
    const park = spawnSync(BUN, [join(AIDLC_SRC, "tools", "aidlc-state.ts"), "park", "--person-asked", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", env: { ...process.env, ...V8_ENV },
    });
    expect(park.status, `${park.stdout}${park.stderr}`).toBe(0);
    const parked = readFileSync(seededStateFile(proj), "utf-8");
    expect(parked).not.toBe(state);
    expect(parked).toMatch(/^- \*\*State Version\*\*: 8$/m);
    v8Next(proj);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*State Version\*\*: 10$/m);
    expect(kept()).toEqual(["aidlc-state.v8.md"]);
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(parked);
    expect(upgradeRow(proj)).toMatch(/^\*\*Original\*\*: aidlc-state\.v8\.md$/m);
    expect(statusOf(proj)).toMatch(/^Brought up: +from an older AI-DLC on \d{4}-\d{2}-\d{2} \(the record as it was: aidlc-state\.v8\.md\)$/m);
  });

  // No platform can see a folder a program holds open without trying the
  // move (nor, on Windows, one this user cannot change), so doctor and status
  // name none: they say the next step brings the work up or names the folder
  // in the way, never that it brings the work up, however often it is held.
  test("while every step is held by a folder held open, doctor and status never promise the next step brings the work up", () => {
    const { proj, state } = v8Project("inception-gate");
    const fail = { AIDLC_TEST: "1", AIDLC_TEST_FOLDER_MOVE_FAIL: "inception/requirements-analysis" };
    for (let attempt = 0; attempt < 2; attempt++) expect(v8Next(proj, [], fail).directive?.kind).toBe("print");
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
    const doctor = doctorOf(proj);
    const status = statusOf(proj);
    expect(doctor).not.toContain("AI-DLC brings this record up to 10 at its next step");
    expect(doctor).toContain(
      "State Version: 8 (AI-DLC's next step brings this record up to 10, or names a folder in the way and what frees it)",
    );
    expect(status.match(/^Brought up: .*$/gm)).toEqual([
      "Brought up:     at AI-DLC's next step, from the five phases an earlier AI-DLC set this work up in to the seven " +
        "shown here (or that step names a folder in the way and what frees it)",
    ]);
    // What either says, the step does: it names the folder held open, then brings the work up once it is closed.
    expect(String(v8Next(proj, [], fail).directive?.message ?? "")).toContain("/inception/requirements-analysis` to `");
    expect(v8Next(proj).directive?.kind).toBe("run-stage");
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*State Version\*\*: 10$/m);
  });

  test("two folders held open are named together, in plain English", () => {
    const { proj } = v8Project("inception-gate");
    const held = v8Next(proj, [], {
      AIDLC_TEST: "1",
      AIDLC_TEST_FOLDER_MOVE_FAIL: "inception/practices-discovery,inception/requirements-analysis",
    });
    expect(held.directive?.kind).toBe("print");
    const message = String(held.directive?.message ?? "");
    expect(message).toMatch(/AI-DLC could not move `[^`]+\/inception\/practices-discovery` and `[^`]+\/inception\/requirements-analysis` to where this release keeps them: a program on this computer has those folders open[.,] /);
    // Off Windows, EBUSY is also a folder something is mounted on.
    expect(message).toContain(process.platform === "win32"
      ? "has those folders open. Your work is as it was."
      : "has those folders open, or something is mounted there (a container's volume or a network drive). Your work is as it was.");
    expect(message).toContain("Close what has them open (");
    expect(message).not.toMatch(/\bor them\b|has it open|that folder/);
  });

  // A Windows program holding the folder open under WSL (/mnt/c), or on a
  // network share, is refused as EACCES on Linux too, while every folder is
  // writable: the line names closing it, the step that works then, and doctor
  // and status, which cannot see an open folder, promise nothing.
  test("a move refused with EACCES while every folder is writable names both reasons, with a step for each", () => {
    const { proj, state } = v8Project("inception-gate");
    const fail = { AIDLC_TEST: "1", AIDLC_TEST_FOLDER_MOVE_FAIL: "inception/requirements-analysis:EACCES" };
    const held = v8Next(proj, [], fail);
    expect(held.directive?.kind).toBe("print");
    const message = String(held.directive?.message ?? "");
    expect(message).not.toMatch(/EACCES|State Version|STATE_UPGRADED/);
    expect(message).toMatch(/AI-DLC could not move `aidlc\/spaces\/default\/intents\/[^/`]+\/inception\/requirements-analysis` to `aidlc\/spaces\/default\/intents\/[^/`]+\/design\/requirements-analysis`, where this release keeps it: /);
    expect(message).toContain("has that folder open, or your user cannot change it. Your work is as it was. Close what has it open (");
    expect(message).toContain("; if nothing has it open, give your user write access to it. Then ask me to carry on");
    expect(message).not.toMatch(/AI-DLC cannot change/);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
    expect(upgradeRows(proj)).toBe(0);
    // Every folder is writable, so neither names one this user cannot change.
    expect(doctorOf(proj)).not.toMatch(/cannot bring this record up|give your user write access/);
    expect(statusOf(proj)).not.toMatch(/^Brought up: +waiting/m);
  });

  // Linux refuses moving a folder this user may not write to a new parent,
  // whatever its parent allows, so each locked folder is named.
  test.skipIf(process.platform !== "linux")("two folders this user cannot change are named together, in plain English", () => {
    const { proj, record } = v8Project("inception-gate");
    const unlocks = ["practices-discovery", "requirements-analysis"].map((slug) => lockFolder(join(record, "inception", slug)));
    let message = "";
    try {
      message = String(v8Next(proj).directive?.message ?? "");
    } finally {
      for (const unlock of unlocks) unlock();
    }
    expect(message).toMatch(/^Tell the person in one line: "AI-DLC cannot change `[^`]+\/inception\/practices-discovery` and `[^`]+\/inception\/requirements-analysis` \(another user or a container may own them, or they may be read-only\), so it could not move your work to where this release keeps it\. Your work is as it was\. Give your user write access to them, then ask me to carry on, /);
    expect(message).not.toMatch(/\bor them\b|has it open|that folder/);
  });

  // Windows cannot tell a folder this user may not change from the outside
  // (its access check reads only a read-only attribute, which folders ignore).
  test.skipIf(process.platform === "win32")("a folder this user cannot change: the step names it and how to free it, doctor and status name it too, and once freed the next step brings the work up", () => {
    const { proj, state, record, documents } = v8Project("inception-gate");
    const unlock = lockFolder(join(record, "inception"));
    let message = "";
    let again = "";
    let doctor = "";
    let status = "";
    try {
      message = String(v8Next(proj).directive?.message ?? "");
      again = String(v8Next(proj).directive?.message ?? "");
      doctor = doctorOf(proj);
      status = statusOf(proj);
    } finally {
      unlock();
    }
    const folder = /`(aidlc\/spaces\/default\/intents\/[^/`]+\/inception)`/.exec(message)?.[1] ?? "";
    expect(folder).not.toBe("");
    expect(message).toContain(
      `AI-DLC cannot change \`${folder}\` (another user or a container may own it, or it may be read-only), so it ` +
        "could not move your work to where this release keeps it. Your work is as it was. Give your user write access " +
        "to it, then ask me to carry on, and AI-DLC finishes moving your work and picks up where you were.",
    );
    expect(message).not.toMatch(/Close what has|has that folder open|EACCES|EPERM/);
    expect(again).toBe(message);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
    expect(stageDocuments(record)).toEqual(documents);
    expect(upgradeRows(proj)).toBe(0);
    // Doctor and status say the bring-up waits on that folder, never that the next step makes it.
    expect(doctor).not.toContain("AI-DLC brings this record up to 10 at its next step");
    expect(doctor).not.toContain("AI-DLC's next step brings this record up");
    expect(doctor).toContain(`State Version: 8 (AI-DLC cannot bring this record up to 10 while it cannot change ${folder})`);
    expect(doctor).toContain(
      `give your user write access to ${folder} (another user or a container may own it, or it may be read-only), then ask AI-DLC to carry on`,
    );
    expect(status.match(/^Brought up: .*$/gm)).toEqual([
      `Brought up:     waiting: AI-DLC cannot change ${folder} (another user or a container may own it, or it may be ` +
        "read-only); give your user write access to it, then ask AI-DLC to carry on",
    ]);
    // Once it can be changed, the next step brings the record up whole and shows the open gate.
    const r = v8Next(proj);
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("requirements-analysis");
    expect(r.directive?.gate).toBe(true);
    expectDocumentsMoved(record, documents);
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(state);
  });

  test("what Finder and Explorer leave in the old folders is no one's work: the old folders go, and doctor says nothing of it", () => {
    const { proj, record } = v8Project("unit-walk");
    const dropped = [
      "ideation/.DS_Store", "inception/.DS_Store", "inception/Thumbs.db", "construction/.DS_Store",
      "construction/store/.DS_Store", "construction/store/desktop.ini", "ideation/intent-capture/.DS_Store",
    ];
    for (const path of dropped) writeFileSync(join(record, ...path.split("/")), "written by the file browser\n");
    // The one inside a stage folder moves with it; the rest go with the old folders.
    const inStage = "ideation/intent-capture/.DS_Store";
    const documents = new Map([...stageDocuments(record)].filter(([path]) => path === inStage || !dropped.includes(path)));
    const r = v8Next(proj);
    expect(r.directive?.stage).toBe("code-generation");
    expect(r.directive?.unit).toBe("store");
    expectDocumentsMoved(record, documents);
    expect(existsSync(join(record, "discover", "intent-capture", ".DS_Store"))).toBe(true);
    expect(upgradeRow(proj)).toMatch(/^\*\*Left behind\*\*: none$/m);
    const doctor = spawnSync(BUN, [UTIL, "doctor", "--verbose", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(`${doctor.stdout}`).toMatch(/State Version: 10 \(brought up from 8 on /);
    expect(`${doctor.stdout}${doctor.stderr}`).not.toMatch(/Left where an earlier AI-DLC kept it|\.DS_Store|Thumbs\.db|desktop\.ini/);
  });

  test("work put back on 2.11.4, carried on there and brought up again keeps that original under its own name, and doctor and status name it", () => {
    const { proj, state, record } = v8Project("inception-gate");
    v8Next(proj);
    // Put back as the guide once said: the kept copy copied over the state, every folder moved back.
    putBackByHand(proj, record, "copy");
    // On 2.11.4 the person approves Requirements Analysis.
    const carried = readFileSync(seededStateFile(proj), "utf-8")
      .replace("- [?] requirements-analysis — EXECUTE", "- [x] requirements-analysis — EXECUTE");
    expect(carried).not.toBe(state);
    writeFileSync(seededStateFile(proj), carried, "utf-8");
    v8Next(proj);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \[x\] requirements-analysis — EXECUTE$/m);
    // The first original is never overwritten, and the second is kept beside it.
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(state);
    expect(readFileSync(join(record, "aidlc-state.v8.2.md"), "utf-8")).toBe(carried);
    const rows = upgradeRowBlocks(proj);
    expect(rows.length).toBe(2);
    expect(rows[1]).toMatch(/^\*\*Original\*\*: aidlc-state\.v8\.2\.md$/m);
    const doctor = spawnSync(BUN, [UTIL, "doctor", "--verbose", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(`${doctor.stdout}`).toMatch(/State Version: 10 \(brought up from 8 on \d{4}-\d{2}-\d{2}; the record as it was is aidlc-state\.v8\.2\.md\)/);
    const status = spawnSync(BUN, [UTIL, "status", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(`${status.stdout}`).toMatch(/^Brought up: +from an older AI-DLC on \d{4}-\d{2}-\d{2} \(the record as it was: aidlc-state\.v8\.2\.md\)$/m);
  });

  test("work put back the way the guide says (the kept copy moved back) is kept under the plain name when it is brought up again", () => {
    const { proj, record } = v8Project("inception-gate");
    v8Next(proj);
    putBackByHand(proj, record, "move");
    expect(existsSync(join(record, "aidlc-state.v8.md"))).toBe(false);
    const carried = readFileSync(seededStateFile(proj), "utf-8")
      .replace("- [?] requirements-analysis — EXECUTE", "- [x] requirements-analysis — EXECUTE");
    writeFileSync(seededStateFile(proj), carried, "utf-8");
    v8Next(proj);
    expect(readFileSync(join(record, "aidlc-state.v8.md"), "utf-8")).toBe(carried);
    expect(existsSync(join(record, "aidlc-state.v8.2.md"))).toBe(false);
    expect(upgradeRowBlocks(proj).at(-1)).toMatch(/^\*\*Original\*\*: aidlc-state\.v8\.md$/m);
  });

  test("a v9 record (upstream AI-DLC 2.12 team work) is never brought up or claimed: next, next --claim and unit claim name the 2.12 step", () => {
    const proj = createOrchestrationTestProject();
    created.push(proj);
    const v9 = stateWithVersion("9").replace("- **Skeleton Stance**: on", "- **Skeleton Stance**: on\n- **Unit Ownership**: team");
    writeFileSync(seededStateFile(proj), v9, "utf-8");
    for (const args of [["next"], ["next", "--claim", "store"], ["next", "--release", "store"]]) {
      const r = engine(proj, args);
      expect(r.out, args.join(" ")).toContain("This plan was set up with AI-DLC 2.12 team work, which ");
      expect(r.out).not.toMatch(/predates the current|or newer/);
    }
    const claim = spawnSync(BUN, [join(AIDLC_SRC, "tools", "aidlc-unit.ts"), "claim", "store", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(claim.status).not.toBe(0);
    expect(`${claim.stdout}${claim.stderr}`).toContain("This plan was set up with AI-DLC 2.12 team work, which ");
    expect(`${claim.stdout}${claim.stderr}`).not.toContain("or newer");
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(v9);
    expect(existsSync(join(seededRecordDir(proj), "aidlc-state.v9.md"))).toBe(false);
    expect(upgradeRows(proj)).toBe(0);
  });
});

// What the person reads about a v8 record before and after AI-DLC's first step
// on it: status, the status line and doctor, run as the person runs them.
function statusOf(proj: string): string {
  const res = spawnSync(BUN, [UTIL, "status", "--project-dir", proj], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
  });
  return `${res.stdout ?? ""}${res.stderr ?? ""}`;
}

function statusLineOf(proj: string): string {
  const res = spawnSync(BUN, [join(AIDLC_SRC, "hooks", "aidlc-statusline.ts")], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    input: JSON.stringify({ workspace: { project_dir: proj } }),
  });
  return `${res.stdout ?? ""}${res.stderr ?? ""}`;
}

function doctorOf(proj: string): string {
  const res = spawnSync(BUN, [UTIL, "doctor", "--verbose", "--project-dir", proj], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
  });
  return `${res.stdout ?? ""}${res.stderr ?? ""}`;
}

// The resume context a new chat gets, as the session-start hook gives it.
function sessionStartOf(proj: string): string {
  const res = spawnSync(BUN, [join(AIDLC_SRC, "hooks", "aidlc-session-start.ts")], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    input: JSON.stringify({ session_id: "v8-before-the-step", hook_event_name: "SessionStart", source: "startup" }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
  });
  return `${res.stdout ?? ""}${res.stderr ?? ""}`;
}

function statusLine(out: string, label: string): string {
  return out.split("\n").find((row) => row.startsWith(label)) ?? "";
}

// The Phase Progress rows by phase and bar. The count beside a Unit walk's rows
// is worded from the walk once the record is brought up, so it is left out.
function phaseRows(out: string): string[] {
  const section = out.split("\nPhase Progress:\n")[1]?.split("\n\n")[0] ?? "";
  return section.split("\n").filter((row) => row.trim() !== "").map((row) => row.trim().split(/\s+/).slice(0, 2).join(" "));
}

function definitionChangedRows(proj: string): number {
  const dir = seededAuditDir(proj);
  return readdirSync(dir).reduce((n, f) =>
    n + (readFileSync(join(dir, f), "utf-8").match(/\*\*Event\*\*: STAGE_DEFINITION_CHANGED$/gm)?.length ?? 0), 0);
}

const FIVE_PHASE_NAME = /\b(IDEATION|INCEPTION|CONSTRUCTION|OPERATION)\b/;
const CHANGED_LINES = /changed after it finished|differently from when yours ran|Left where an earlier AI-DLC kept it/;

describe("t282 before AI-DLC's first step on a v8 record, what the person reads shows the seven phases", () => {
  for (const fixture of ["inception-gate", "unit-walk", "operation"]) {
    test(`${fixture}: status, the status line, doctor and the Stop hook's probe read it as the next step brings it up, and nothing as changed`, () => {
      const { proj, state, record, documents } = v8Project(fixture);
      const status = statusOf(proj);
      const line = statusLineOf(proj);
      const doctor = doctorOf(proj);
      const probe = v8Next(proj, [], { AIDLC_STOP_HOOK_PROBE: "1" });
      const resume = sessionStartOf(proj);
      expect(resume).toMatch(/Lifecycle Phase: (DESIGN|OPERATE)\b/);
      expect(resume).not.toMatch(FIVE_PHASE_NAME);
      // Reading wrote nothing: the record is as 2.11.4 left it.
      expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(state);
      expect(stageDocuments(record)).toEqual(documents);
      expect(existsSync(join(record, "aidlc-state.v8.md"))).toBe(false);
      expect(upgradeRows(proj)).toBe(0);
      // No finished stage reads as changed for documents the step has not moved yet.
      for (const out of [status, line, doctor, probe.out]) expect(out).not.toMatch(CHANGED_LINES);
      expect(probe.out).not.toContain("stage_validity");
      for (const out of [status, line]) expect(out).not.toMatch(FIVE_PHASE_NAME);
      // Said once, in plain words: the next step brings the work up to the seven phases.
      expect(status.match(/^Brought up: .*$/gm)).toEqual([
        "Brought up:     at AI-DLC's next step, from the five phases an earlier AI-DLC set this work up in to the seven " +
          "shown here (or that step names a folder in the way and what frees it)",
      ]);
      expect(doctor).toContain(
        "State Version: 8 (AI-DLC's next step brings this record up to 10, or names a folder in the way and what frees it)",
      );
      // Once the step has run, the work reads as status and the status line showed it before.
      v8Next(proj);
      const after = statusOf(proj);
      for (const label of ["Phase:", "Current Stage:", "Completion:", "Last Completed:"]) {
        expect(statusLine(status, label), label).toBe(statusLine(after, label));
      }
      expect(phaseRows(status)).toEqual(phaseRows(after));
      expect(statusLine(status, "Phase:")).toMatch(/ (DESIGN|OPERATE)$/);
      // A Next Stage is the one the brought-up work names, never the stale field of a Unit walk.
      const next = statusLine(status, "Next Stage:");
      if (next !== "") expect(next).toBe(statusLine(after, "Next Stage:"));
      expect(line).toBe(statusLineOf(proj));
    });
  }

  // The step's first move goes back to Performance Validation, which the seven
  // phases put behind the cursor, and on work that had only just entered CI
  // Pipeline to the Secure reviews it had just passed: status counts them
  // before the step as after it, reading the current stage's work where 2.11.4
  // still keeps it (once CI Pipeline has a file, the reviews are not owed).
  const owedCases: { fixture: string; ciFile?: boolean; completion: string; test: string; secure: string | null }[] = [
    { fixture: "pv-deploy-entered", completion: "3/8 stages (38%)", test: "S░ 0/1", secure: null },
    { fixture: "pv-incident-gate", completion: "5/8 stages (63%)", test: "S░ 0/1", secure: null },
    { fixture: "pv-ci-entered", completion: "1/11 stages (9%)", test: "█░ 1/2", secure: "░░ 0/2" },
    { fixture: "pv-ci-entered", ciFile: true, completion: "1/9 stages (11%)", test: "█░ 1/2", secure: null },
  ];
  for (const owed of owedCases) {
    test(`${owed.fixture}${owed.ciFile ? " with CI Pipeline's work begun" : ""}: status counts the stages the step goes back to, before it as after it`, () => {
      const { proj, record } = v8Project(owed.fixture);
      if (owed.ciFile) {
        mkdirSync(join(record, "construction", "ci-pipeline"), { recursive: true });
        writeFileSync(join(record, "construction", "ci-pipeline", "pipeline.md"), "# CI pipeline\n\nBuild on every push.\n");
      }
      const before = statusOf(proj);
      expect(upgradeRows(proj)).toBe(0);
      v8Next(proj);
      expect(upgradeRows(proj)).toBe(1);
      const after = statusOf(proj);
      for (const out of [before, after]) {
        expect(statusLine(out, "Completion:")).toStartWith(`Completion:     ${owed.completion}`);
        expect(out).toMatch(/^Next Stage: +Performance Validation$/m);
        expect(out).toMatch(new RegExp(`^ {2}TEST +${owed.test}$`, "m"));
        if (owed.secure === null) expect(out).not.toMatch(/^ {2}SECURE /m);
        else expect(out).toMatch(new RegExp(`^ {2}SECURE +${owed.secure}$`, "m"));
      }
      expect(phaseRows(before)).toEqual(phaseRows(after));
    });
  }

  test("unit-walk: no stale Next Stage, and the status line counts the Units from the plan where 2.11.4 kept it", () => {
    const { proj } = v8Project("unit-walk");
    const status = statusOf(proj);
    expect(status).not.toMatch(/^Next Stage: +NFR Requirements$/m);
    expect(status).toMatch(/^ {2}DESIGN +\S+ Unit 1 of 2$/m);
    expect(statusLineOf(proj)).toContain("DESIGN Unit 1 of 2 > Code Generation for store");
  });
});

// 2.11.4 hashed each stage's graph contract with its own phase name, and three
// conditions named its phases and stage numbers. Read through the frozen
// five-to-seven table, a receipt whose contract changed only there holds; a
// contract that changed what the stage reads still reads as AI-DLC's own change.
describe("t282 a v8 record's stage receipts read in their seven-phase form", () => {
  test("after the bring-up no finished stage reads as one AI-DLC now does differently, and no row says so", () => {
    for (const fixture of ["inception-gate", "unit-walk", "operation"]) {
      const { proj } = v8Project(fixture);
      v8Next(proj);
      v8Next(proj);
      expect(statusOf(proj), fixture).not.toMatch(/differently from when yours ran/);
      expect(definitionChangedRows(proj), fixture).toBe(0);
      const validity = inspectStageValidity(proj, readFileSync(seededStateFile(proj), "utf-8"));
      expect(validity.redefined, fixture).toEqual([]);
      expect(validity.renewed, fixture).toEqual([]);
    }
  });

  test("the five-phase form takes the old folder and only the condition wording this release ships", () => {
    const stage = loadGraph().find((entry) => entry.slug === "delivery-planning");
    if (stage === undefined) throw new Error("delivery-planning is missing from the graph");
    const older = fivePhaseGraphContract(stage);
    expect(older?.phase).toBe("inception");
    expect(older?.condition).toBe(FIVE_PHASE_CONDITIONS["delivery-planning"]?.fivePhase);
    expect(older?.consumes).toEqual(stage.consumes);
    // A condition a later release words again is that release's change, never 2.11.4's.
    expect(fivePhaseGraphContract({ ...stage, condition: "Runs when the team asks for it" })?.condition)
      .toBe("Runs when the team asks for it");
    // A stage 2.11.4 never shipped has no five-phase form.
    expect(fivePhaseGraphContract({ ...stage, slug: "code-review", phase: "secure" })).toBeNull();
  });

  test("Performance Validation, whose inputs changed with the seven phases, still reads as redefined", () => {
    const { proj } = v8Project("inception-gate");
    v8Next(proj);
    const graph = loadGraph();
    const now = graph.find((stage) => stage.slug === "performance-validation");
    if (now === undefined) throw new Error("performance-validation is missing from the graph");
    // Its contract as 2.11.4 shipped it: in Operation, reading the dashboards.
    const shipped = { ...now, phase: "operation", consumes: [...(now.consumes ?? []), { artifact: "dashboards", required: true }] };
    const older = graph.map((stage) => (stage.slug === now.slug ? shipped : stage));
    const state = readFileSync(seededStateFile(proj), "utf-8")
      .replace(/^- \[ \] performance-validation —/m, "- [x] performance-validation —");
    const fields = stageValidationAuditFields(proj, shipped, state, older);
    // The hash 2.11.4's own graph contract fingerprint gives this stage.
    expect(JSON.parse(fields["Validation Basis"] ?? "{}").graphContract)
      .toBe("sha256:2862f2aab4a5c443171884d5f577a399b12f31352d20c9e5d8ade81a3a73f3d3");
    appendAuditEntry("STAGE_COMPLETED", { Stage: now.slug, ...fields }, proj);
    expect(inspectStageValidity(proj, state).redefined.map((entry) => entry.stage)).toEqual(["performance-validation"]);
  });
});
