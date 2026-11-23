// covers: subcommand:aidlc-utility:doctor, function:classifyStateVersion, function:bringStateUpToDate, function:inspectStageValidity
//
// The state-version gate and the bring-up beside it. v8 renamed the Inception
// `application-design` stage to `domain-design` and added `contract-design`;
// v10 is the seven-phase layout (Discover through Operate) with the three
// Secure stages added. A v7 record (2.1.x to 2.3.0) and a v8 record (2.6.1 to
// 2.11.4, five phases) are brought up in place the first time the engine reads
// them: the real records those releases wrote (tests/fixtures/state-v7 and
// tests/fixtures/state-v8) resume where they stood, approvals kept, every
// document moved to its seven-phase folder, the original kept beside it, one
// audit row, nothing said; doctor and status show it on purpose. A version no
// step brings up (below 7, 9 from upstream 2.12 team work, newer, unparseable)
// is still refused by `next`, `report` and doctor alike, without the old
// archive-and-start-again advice.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { describe, expect, test, afterEach, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
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
import { sevenPhaseRecordPath } from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import { sevenPhaseStateText } from "../../dist/claude/.claude/tools/aidlc-seven-phase-upgrade.ts";
import { inspectStageValidity } from "../../dist/claude/.claude/tools/aidlc-validity.ts";

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

  test("a v7 state passes the state-version row: AI-DLC brings it up at its next step", () => {
    const { out } = runDoctor("7");
    expect(out).toMatch(/State Version: 7 \(AI-DLC brings this record up to 10 at its next step\)/);
    expect(out).not.toMatch(/state version current/);
    expect(out).not.toContain("mv aidlc");
  });

  test("a v8 state (2.6.1 to 2.11.4, five phases) passes the state-version row: AI-DLC brings it up at its next step", () => {
    const { out } = runDoctor("8");
    expect(out).toMatch(/State Version: 8 \(AI-DLC brings this record up to 10 at its next step\)/);
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
    // The release that writes it and this install's one step, in plain words.
    expect(out).toContain("This plan was set up with AI-DLC 2.12 or newer");
    expect(out).toContain("To carry on");
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
  // not "predate" v8: a copied project hears the release that writes it and its
  // own step to carry on (t-newer-work-update-offer owns the native offer).
  test("`next` on a FUTURE (v9) state names the newer release and the step, not a past-version refusal", () => {
    const r = runOrchestrate("next", "9");
    expect(r.kind).toBe("print");
    expect(r.out).toContain("This plan was set up with AI-DLC 2.12 or newer");
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
// through its first Unit, and work in Operation. Each holds its stage
// documents, its review records and its audit as 2.11.4 left them.
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
    expect(r.directive?.stage_validity?.directly_stale).toEqual(["reverse-engineering"]);
    expect(r.directive?.stage_validity?.needs_revalidation).toEqual([]);
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

  test("a v9 record (upstream AI-DLC 2.12 team work) is never brought up or claimed: next, next --claim and unit claim name the 2.12 step", () => {
    const proj = createOrchestrationTestProject();
    created.push(proj);
    const v9 = stateWithVersion("9").replace("- **Skeleton Stance**: on", "- **Skeleton Stance**: on\n- **Unit Ownership**: team");
    writeFileSync(seededStateFile(proj), v9, "utf-8");
    for (const args of [["next"], ["next", "--claim", "store"], ["next", "--release", "store"]]) {
      const r = engine(proj, args);
      expect(r.out, args.join(" ")).toContain("This plan was set up with AI-DLC 2.12 or newer");
      expect(r.out).not.toMatch(/predates the current/);
    }
    const claim = spawnSync(BUN, [join(AIDLC_SRC, "tools", "aidlc-unit.ts"), "claim", "store", "--project-dir", proj], {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8",
    });
    expect(claim.status).not.toBe(0);
    expect(`${claim.stdout}${claim.stderr}`).toContain("This plan was set up with AI-DLC 2.12 or newer");
    expect(readFileSync(seededStateFile(proj), "utf-8")).toBe(v9);
    expect(existsSync(join(seededRecordDir(proj), "aidlc-state.v9.md"))).toBe(false);
    expect(upgradeRows(proj)).toBe(0);
  });
});
