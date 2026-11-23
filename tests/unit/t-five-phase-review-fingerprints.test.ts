// covers: function:reviewManifestForms, function:reviewArtifactFingerprint, function:currentFingerprintForm,
// function:fivePhaseFingerprintForm, subcommand:aidlc-bolt:checkpoint, subcommand:aidlc-log:review
//
// A five-phase AI-DLC (2.11.4) hashed a stage's documents under the logical
// paths of its own folders (`inception/<stage>/<file>`,
// `construction/<unit>/<stage>/<file>`), and recorded that fingerprint on the
// review receipt, the Unit's completion and the Unit's checkpoint approval. The
// 8 to 10 state step moves the folders and never rewrites a record, so the same
// documents now hash under seven-phase paths. The five-phase manifest of the
// same documents is an older form of the current fingerprint, as a manifest
// over raw line endings is: a Unit reviewed and approved before the update is
// still reviewed and approved, and nobody is asked again. A document changed
// since, or another Unit's documents, is still a change.
//
// Mechanism: function - the fingerprints of a scratch project's documents; and
// the shipped review logger and checkpoint tool, with the documents hashed as
// 2.11.4 hashed them (AIDLC_TEST_FIVE_PHASE_LOGICAL_PATHS) while the Unit is
// built and approved.
import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import { fivePhaseFingerprintForm } from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import {
  artifactFilename,
  currentFingerprintForm,
  findStageBySlug,
  freshReviewReceipts,
  latestMainWorkflowStageRunFloorForProject,
  reviewArtifactFingerprint,
} from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import {
  AIDLC_SRC, cleanupTestProject, createTestProject, resetAidlcEnv,
  seedAidlcMemory, seedBoltDag, seededRecordDir, seededStateFile, seedStateFile,
} from "../harness/fixtures.ts";
import { phaseFor } from "../harness/stage-phase.ts";
import { resolveSwarmCheckpoint } from "../../dist/claude/.claude/tools/aidlc-swarm-checkpoints.ts";
import {
  approveNativeCheckpoint, checkReviewFinalizeAndLand, cleanupCheckpointFixtures, fixture as swarmFixture,
  ISOLATED_GIT_ENV, prepare, writeUnitSource,
} from "../harness/swarm-checkpoint.ts";

// The stage's checks are not this file's subject.
process.env.AIDLC_DISABLE_SENSORS = "1";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

resetAidlcEnv();
const projects: string[] = [];
afterEach(() => {
  while (projects.length) cleanupTestProject(projects.pop());
  cleanupCheckpointFixtures();
});
const stages = ["functional-design", "nfr-requirements", "nfr-design", "infrastructure-design", "code-generation"];
const REVIEWER = findStageBySlug("code-generation")!.reviewer!;
const SEPARATOR = "—";

// Documents hashed as a five-phase release hashed them, while `run` records them.
function asFivePhase<T>(run: () => T): T {
  process.env.AIDLC_TEST_FIVE_PHASE_LOGICAL_PATHS = "1";
  ISOLATED_GIT_ENV.AIDLC_TEST_FIVE_PHASE_LOGICAL_PATHS = "1";
  try {
    return run();
  } finally {
    delete process.env.AIDLC_TEST_FIVE_PHASE_LOGICAL_PATHS;
    delete ISOLATED_GIT_ENV.AIDLC_TEST_FIVE_PHASE_LOGICAL_PATHS;
  }
}

// Classic, two Units, advisory reviews (one pass per stage), checkpoints on,
// Unit by Unit.
function fixture(policy: string): string {
  const p = createTestProject();
  projects.push(p);
  seedAidlcMemory(p);
  writeFileSync(seededStateFile(p), `# AI-DLC State Tracking
## Project Information
- **Project**: A Unit approved before the update
- **Project Type**: Greenfield
- **Project Type Source**: you
- **Scope**: classic
- **State Version**: 8
## Runtime State
- **Revision Count**: 0
- **Skeleton Stance**: off
- **Construction Iteration**: unit-major
- **Construction Checkpoints**: enabled
- **Construction Execution**: serial
- **Construction Autonomy Mode**: gated
- **Review Override**: advisory
- **Guard Policy**: ${policy}
## Scope Configuration
- **Stages to Execute**: all
- **Stages to Skip**: none
- **Depth**: Standard
- **Test Strategy**: Standard
## Stage Progress
### DESIGN PHASE
${stages.map((stage) => `- [${stage === "functional-design" ? "-" : " "}] ${stage} ${SEPARATOR} EXECUTE`).join("\n")}
### TEST PHASE
- [ ] build-and-test ${SEPARATOR} EXECUTE
## Current Status
- **Lifecycle Phase**: DESIGN
- **Current Stage**: functional-design
- **Status**: Running
`);
  seedBoltDag(p, ["alpha", "beta"]);
  mkdirSync(join(p, "src"), { recursive: true });
  for (const unit of ["alpha", "beta"]) {
    writeFileSync(join(p, "src", `${unit}.ts`), `export const ${unit} = 1;\n`);
  }
  appendAuditEntry("WORKFLOW_STARTED", { Scope: "classic" }, p);
  return p;
}

function unitDir(p: string, unit: string, slug: string): string {
  return join(seededRecordDir(p), phaseFor(slug), unit, slug);
}

// Each declared output of a stage for a Unit, written; their names.
function writeOutputs(p: string, unit: string, slug: string, body = (name: string) => `# ${unit} ${name}\n`): string[] {
  const dir = unitDir(p, unit, slug);
  mkdirSync(dir, { recursive: true });
  const names = (findStageBySlug(slug)!.produces ?? []).map(artifactFilename);
  for (const name of names) writeFileSync(join(dir, name), body(name));
  return names;
}

// The manifest fingerprint a five-phase release recorded for a Unit's stage:
// each output under construction/<unit>/<stage>/, in that path order.
function fivePhaseManifest(p: string, unit: string, slug: string, names: string[]): string {
  const manifest = names.map((name): [string, string] => [
    `construction/${unit}/${slug}/${name}`,
    `sha256:${createHash("sha256").update(readFileSync(join(unitDir(p, unit, slug), name))).digest("hex")}`,
  ]).sort(([a], [b]) => a.localeCompare(b));
  return `sha256:${createHash("sha256").update(JSON.stringify(manifest)).digest("hex")}`;
}

describe("a review fingerprint recorded on a five-phase release", () => {
  test("is an older form of the same documents' current fingerprint", () => {
    const p = fixture("strict (set by you)");
    const stage = findStageBySlug("code-generation")!;
    const names = writeOutputs(p, "alpha", "code-generation");
    const recorded = fivePhaseManifest(p, "alpha", "code-generation", names);
    const current = reviewArtifactFingerprint(p, stage, "alpha")!;
    expect(current).not.toBe(recorded);
    expect(currentFingerprintForm(recorded)).toBe(current);
    expect(fivePhaseFingerprintForm(current)).toBe(recorded);
    // The test switch records exactly that form.
    expect(asFivePhase(() => reviewArtifactFingerprint(p, stage, "alpha"))).toBe(recorded);
  });

  test("a document changed since, or another Unit's documents, is a change", () => {
    const p = fixture("strict (set by you)");
    const stage = findStageBySlug("code-generation")!;
    const names = writeOutputs(p, "alpha", "code-generation");
    writeOutputs(p, "beta", "code-generation", (name) => `# alpha ${name}\n`);
    const recorded = fivePhaseManifest(p, "alpha", "code-generation", names);
    const beta = fivePhaseManifest(p, "beta", "code-generation", names);
    const alphaNow = reviewArtifactFingerprint(p, stage, "alpha")!;
    reviewArtifactFingerprint(p, stage, "beta");
    expect(currentFingerprintForm(beta)).not.toBe(alphaNow);
    writeFileSync(join(unitDir(p, "alpha", "code-generation"), "code-summary.md"), "# alpha code summary, revised\n");
    const changed = reviewArtifactFingerprint(p, stage, "alpha")!;
    expect(changed).not.toBe(alphaNow);
    expect(currentFingerprintForm(recorded)).not.toBe(changed);
  });

  test("a stage-level stage with a summary input, and one hashed over raw line endings, keep their receipts", () => {
    const p = createTestProject();
    projects.push(p);
    seedStateFile(p, "state-mid-inception.md");
    const stage = findStageBySlug("requirements-analysis")!;
    const dir = join(seededRecordDir(p), phaseFor("requirements-analysis"), "requirements-analysis");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "requirements.md"), "# Requirements\r\n\r\n- FR1 Sign up\r\n");
    writeFileSync(join(dir, "requirements-analysis-questions.md"), "# Questions\r\n");
    const recorded = asFivePhase(() => reviewArtifactFingerprint(p, stage))!;
    process.env.AIDLC_TEST_RAW_LINE_ENDINGS = "1";
    let recordedRaw: string;
    try {
      recordedRaw = asFivePhase(() => reviewArtifactFingerprint(p, stage))!;
    } finally {
      delete process.env.AIDLC_TEST_RAW_LINE_ENDINGS;
    }
    const current = reviewArtifactFingerprint(p, stage)!;
    expect(new Set([recorded, recordedRaw, current]).size).toBe(3);
    expect(currentFingerprintForm(recorded)).toBe(current);
    expect(currentFingerprintForm(recordedRaw)).toBe(current);
    expect(fivePhaseFingerprintForm(current, true)).toBe(recordedRaw);
    writeFileSync(join(dir, "requirements.md"), "# Requirements\r\n\r\n- FR1 Sign up\r\n- FR2 Sign in\r\n");
    expect(currentFingerprintForm(recorded)).not.toBe(reviewArtifactFingerprint(p, stage));
  });
});

function tool(p: string, name: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(process.execPath, [
    join(AIDLC_SRC, `tools/aidlc-${name}.ts`), ...args, "--project-dir", p,
  ], { timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", env });
  return { status: result.status, stdout: result.stdout, out: `${result.stdout}${result.stderr}` };
}

function human(p: string, prompt: string, session: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, AIDLC_PROJECT_DIR: p, CLAUDE_PROJECT_DIR: p };
  delete env.AIDLC_SKIP_HUMAN_PRESENCE_GUARD;
  delete env.AIDLC_UNATTENDED;
  const result = spawnSync(process.execPath, [join(AIDLC_SRC, "tools/aidlc.ts"), "engine", "hook", "record-human-turn"], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    encoding: "utf-8", cwd: p, env,
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: session, prompt }),
  });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
}

function recordCommand(p: string) {
  if (readFileSync(seededStateFile(p), "utf-8").includes("- **Construction Verification Command**:")) return;
  const script = join(seededRecordDir(p), "check.cjs");
  writeFileSync(script, "process.exit(0);");
  const quote = (value: string) => process.platform === "win32"
    ? `"${value.replaceAll('"', '""')}"`
    : `'${value.replaceAll("'", "'\\''")}'`;
  const command = `${quote(process.execPath)} ${quote(script)}`;
  const identity = ["--stage", "code-generation", "--checkpoint", "verification-command", "--command", command, "--session", "t-five-command"];
  const env = { ...process.env, AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" };
  const decision = tool(p, "log", ["decision", ...identity, "--decision", "Use this command to verify each completed Unit?", "--options", "Approve,Request Changes"], env);
  expect(decision.status, decision.out).toBe(0);
  human(p, "Approve", "t-five-command");
  for (const [name, args] of [["log", ["answer", ...identity, "--details", "Approve"]], ["state", ["set-construction-verification-command", command]]] as const) {
    const result = tool(p, name, [...args], env);
    expect(result.status, result.out).toBe(0);
  }
}

function approve(p: string, unit: string): void {
  recordCommand(p);
  const checkpoint = (args: string[]) => {
    const result = tool(p, "bolt", ["checkpoint", "--unit", unit, "--kind", "unit", ...args]);
    expect(result.status, result.out).toBe(0);
    return JSON.parse(result.stdout);
  };
  const verified = checkpoint(["--action", "verify"]);
  expect(verified.errors).toEqual([]);
  expect(verified.verified).toBe(true);
  const session = `t-five-${unit}`;
  checkpoint(["--action", "ask", "--session", session]);
  human(p, "Approve", session);
  expect(checkpoint(["--action", "approve", "--session", session, "--user-input", "Approve"]).approved).toBe(true);
}

type Status = { approved: boolean; errors: string[]; fingerprint: string };

function checkpointStatus(p: string, unit: string): Status {
  const status = tool(p, "bolt", ["checkpoint", "--unit", unit, "--kind", "unit", "--action", "status"]);
  expect(status.status, status.out).toBe(0);
  return JSON.parse(status.stdout) as Status;
}

// One review through the logger, as a run records it: the request, the
// reviewer's file in the slot it names, then the verdict.
function reviewThroughLog(p: string, args: string[]): void {
  const requested = tool(p, "log", args);
  expect(requested.status, requested.out).toBe(0);
  const request = JSON.parse(requested.stdout.trim().split(/\r?\n/).at(-1)!) as { reviewFile: string };
  const iteration = args[args.indexOf("--iteration") + 1];
  mkdirSync(dirname(join(p, request.reviewFile)), { recursive: true });
  writeFileSync(join(p, request.reviewFile), `**Verdict:** READY\n**Reviewer:** ${REVIEWER}\n` +
    `**Iteration:** ${iteration}\n\n### Findings\n\nNo blocking findings.\n`);
  const recorded = tool(p, "log", [...args, "--verdict", "READY"]);
  expect(recorded.status, recorded.out).toBe(0);
}

// A Unit built as a run records it: each stage's outputs, its review through
// the logger, then its completion.
function build(p: string, unit: string): void {
  for (const slug of stages) {
    const stage = findStageBySlug(slug)!;
    writeOutputs(p, unit, slug);
    if (stage.workspace_requires) {
      writeFileSync(join(unitDir(p, unit, "code-generation"), "source-manifest.json"), JSON.stringify({
        stage: "code-generation", unit, version: 1, writes: [{ path: `src/${unit}.ts` }],
      }));
    }
    reviewThroughLog(p, ["review", "--stage", slug, "--reviewer", stage.reviewer!, "--unit", unit, "--iteration", "1"]);
    const floor = latestMainWorkflowStageRunFloorForProject(p, slug, true, unit);
    appendAuditEntry("UNIT_COMPLETED", stage.workspace_requires ? { Stage: slug, Unit: unit, "Run floor": floor } : {
      Stage: slug, Unit: unit, Mode: "wave", "Run floor": floor,
      "Artifact Fingerprint": reviewArtifactFingerprint(p, stage, unit, { requireRequiredArtifacts: true })!,
    }, p);
  }
}

describe("a Unit reviewed and approved at its checkpoint on a five-phase release", () => {
  for (const policy of ["strict (set by you)", "off (from scope classic)"]) {
    test(`Guard Policy ${policy.split(" ")[0]}: stays approved after the update, with no review or question owed`, () => {
      const p = fixture(policy);
      const before = asFivePhase(() => {
        build(p, "alpha");
        approve(p, "alpha");
        return checkpointStatus(p, "alpha");
      });
      expect(before, JSON.stringify(before)).toMatchObject({ approved: true, errors: [] });
      const after = checkpointStatus(p, "alpha");
      expect(after, JSON.stringify(after)).toMatchObject({ approved: true, errors: [] });
    }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
  }

  test("Guard Policy strict: a document of the Unit changed after the update is a change", () => {
    const p = fixture("strict (set by you)");
    const before = asFivePhase(() => {
      build(p, "alpha");
      approve(p, "alpha");
      return checkpointStatus(p, "alpha");
    });
    expect(before.approved).toBe(true);
    writeFileSync(join(unitDir(p, "alpha", "functional-design"), "functional-spec.md"), "# alpha functional spec, revised\n");
    const after = checkpointStatus(p, "alpha");
    expect(after.approved, JSON.stringify(after)).toBe(false);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
});

describe("a swarm batch approved at its checkpoint on a five-phase release", () => {
  test("stays approved after the update", () => {
    const pd = asFivePhase(() => {
      const pd = swarmFixture(["alpha"]);
      const prepared = prepare(pd);
      expect(prepared.code, `${prepared.out}\n${prepared.err}`).toBe(0);
      writeUnitSource(pd, "alpha", 2);
      checkReviewFinalizeAndLand(pd, { alpha: 2 });
      approveNativeCheckpoint(pd, ["alpha"]);
      expect(resolveSwarmCheckpoint(pd, 1, ["alpha"]).approved).toBe(true);
      return pd;
    });
    const after = resolveSwarmCheckpoint(pd, 1, ["alpha"]);
    expect(after, JSON.stringify(after)).toMatchObject({ approved: true, errors: [] });
  }, NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS * 2);
});

describe("a write a five-phase release recorded after the Units' reviews", () => {
  // The record's folder as the audit spells it, from the project.
  const record = (p: string) => seededRecordDir(p).slice(p.length + 1).replaceAll("\\", "/");
  const receipts = (p: string) => freshReviewReceipts(p, readFileSync(seededStateFile(p), "utf-8"),
    findStageBySlug("functional-design")!);

  test("reopens the review of the Unit it names, and only that one", () => {
    const p = fixture("strict (set by you)");
    build(p, "alpha");
    build(p, "beta");
    expect([...receipts(p).unitVerdicts.keys()].sort()).toEqual(["alpha", "beta"]);
    appendAuditEntry("ARTIFACT_UPDATED", {
      Stage: "functional-design", File: `${record(p)}/construction/alpha/functional-design/functional-spec.md`,
    }, p);
    const after = receipts(p);
    expect([...after.unitStale]).toEqual(["alpha"]);
    expect([...after.unitVerdicts.keys()]).toEqual(["beta"]);
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("a file the stage does not declare reopens nothing", () => {
    const p = fixture("strict (set by you)");
    build(p, "alpha");
    appendAuditEntry("ARTIFACT_UPDATED", {
      Stage: "functional-design", File: `${record(p)}/construction/alpha/functional-design/notes.md`,
    }, p);
    const after = receipts(p);
    expect([...after.unitStale]).toEqual([]);
    expect([...after.unitVerdicts.keys()]).toEqual(["alpha"]);
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
});
