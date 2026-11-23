// covers: function:checkSummaryConfirmationEvidence, function:summaryOutputDescendsFrom, function:auditRowWritesFile,
// function:latestSensorResults, function:claimAuditRules, function:candidateReviewCoverageProjection,
// subcommand:aidlc-log:answer, audit:ARTIFACT_REUSED
//
// Work confirmed on a five-phase AI-DLC (2.11.4) recorded its paths with the
// five-phase folders: the summary confirmation's Questions File, the writes'
// File, a Keep's Kept Outputs, a check's Output path, a claimed Unit's rows
// and writes.
// The 8 to 10 state step moves the folders and leaves every record as it was
// written (the audit is append-only), so each reader reads that spelling at the
// folder the file moved to: a summary confirmed before the update still counts,
// the documents generated from it still descend from it, and the person is not
// asked again. Content stays bound as before: a changed questions file, another
// file, or a kept document whose bytes changed is still refused.
//
// Mechanism: function, and the shipped answer command - a scratch project's
// record, written by the shipped tools, then given the five-phase spelling a
// 2.11.4 run left in it.
import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import {
  type AuditShardEvent,
  auditRowWritesFile,
  candidateReviewCoverageProjection,
  checkSummaryConfirmationEvidence,
  latestSensorResults,
  loadStageGraphAll,
  summaryOutputDescendsFrom,
} from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { claimAuditRules } from "../../dist/claude/.claude/tools/aidlc-unit.ts";
import {
  AIDLC_SRC,
  cleanupTestProject,
  createTestProject,
  recordArtifactWriteViaHook,
  seedAidlcMemory,
  seededRecordDir,
  seededStateFile,
  seedStateFile,
} from "../harness/fixtures.ts";
import { phaseFor } from "../harness/stage-phase.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const BUN = process.execPath;
const LOG = join(AIDLC_SRC, "tools", "aidlc-log.ts");
const STAGE = "requirements-analysis";
// Where 2.11.4 kept the stage, and where the 8 to 10 step moved it.
const FIVE = `inception/${STAGE}/`;
const SEVEN = `${phaseFor(STAGE)}/${STAGE}/`;
const projects: string[] = [];

afterEach(() => {
  while (projects.length > 0) cleanupTestProject(projects.pop()!);
});

function project(): string {
  const proj = createTestProject();
  projects.push(proj);
  seedAidlcMemory(proj);
  seedStateFile(proj, "state-mid-inception.md");
  return proj;
}

function run(args: string[], proj: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.AIDLC_SKIP_HUMAN_PRESENCE_GUARD;
  const result = Bun.spawnSync({
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    cmd: [BUN, LOG, ...args, "--project-dir", proj],
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { status: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function paths(proj: string) {
  const dir = join(seededRecordDir(proj), phaseFor(STAGE), STAGE);
  mkdirSync(dir, { recursive: true });
  return { artifact: join(dir, "requirements.md"), questions: join(dir, `${STAGE}-questions.md`) };
}

function questionsBody(answer: string): string {
  return [
    "# Requirements Questions", "", "## Q1", "", "- Keep the login flow.", "",
    "## Consolidated Summary Confirmation", "", "- Looks correct", "- Request changes", "",
    `[Answer]: ${answer}`, "",
  ].join("\n");
}

const identity = (questions: string) => [
  "--stage", STAGE, "--checkpoint", "summary-confirmation", "--questions-file", questions,
];

/** The summary shown and its question recorded, then the person's turn. */
function present(proj: string, questions: string): void {
  writeFileSync(questions, questionsBody(""));
  const decision = run(["decision", ...identity(questions), "--decision", "Does this all look correct?"], proj);
  expect(decision.status, decision.stderr).toBe(0);
  appendAuditEntry("HUMAN_TURN", {}, proj);
}

function answer(proj: string, questions: string) {
  writeFileSync(questions, questionsBody("Looks correct"));
  return run(["answer", ...identity(questions), "--details", "Looks correct"], proj);
}

/** Present the summary and record Looks correct; the confirmation's id. */
function confirm(proj: string, questions: string): string {
  present(proj, questions);
  const result = answer(proj, questions);
  expect(result.status, result.stderr).toBe(0);
  return (JSON.parse(result.stdout) as { summary_authorization_id: string }).summary_authorization_id;
}

function evidence(proj: string) {
  const prior = process.env.AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD;
  delete process.env.AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD;
  try {
    const stage = loadStageGraphAll().find((entry) => entry.slug === STAGE)!;
    return checkSummaryConfirmationEvidence(proj, stage, { stateContent: readFileSync(seededStateFile(proj), "utf-8") });
  } finally {
    if (prior !== undefined) process.env.AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD = prior;
  }
}

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/**
 * The record as a five-phase release wrote it: every audit row and the summary
 * confirmation's own record name `from` (the folder the file sits in now) as
 * `to`. The files stay where the 8 to 10 step moved them.
 */
function spelledAs(proj: string, from: string, to: string): void {
  const record = seededRecordDir(proj);
  const pattern = new RegExp(`(^|[\\s/])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gm");
  for (const path of [...files(join(record, "audit")), ...files(join(record, ".aidlc-engine", "summary-authorization"))]) {
    const text = readFileSync(path, "utf-8");
    if (pattern.test(text)) writeFileSync(path, text.replace(pattern, `$1${to}`));
    pattern.lastIndex = 0;
  }
}

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("a summary confirmed on a five-phase release", () => {
  test("still counts for the moved questions file, and the documents generated from it still descend from it", () => {
    const proj = project();
    const { artifact, questions } = paths(proj);
    confirm(proj, questions);
    writeFileSync(artifact, "# Requirements\n\n- FR-1: keep the login flow.\n");
    recordArtifactWriteViaHook(proj, artifact, "Write");
    expect(evidence(proj).ok).toBe(true);
    spelledAs(proj, SEVEN, FIVE);
    const shards = files(join(seededRecordDir(proj), "audit")).map((path) => readFileSync(path, "utf-8")).join("\n");
    expect(shards).toContain(`/${FIVE}${STAGE}-questions.md`);
    expect(shards).not.toContain(`/${SEVEN}`);
    expect(evidence(proj)).toMatchObject({ ok: true });
  });

  test("the questions file changed after the confirmation is still a change", () => {
    const proj = project();
    const { artifact, questions } = paths(proj);
    confirm(proj, questions);
    writeFileSync(artifact, "# Requirements\n");
    recordArtifactWriteViaHook(proj, artifact, "Write");
    spelledAs(proj, SEVEN, FIVE);
    writeFileSync(questions, questionsBody("Looks correct").replace("Keep the login flow.", "Drop the login flow."));
    const result = evidence(proj);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.refusal?.code).toBe("SUMMARY_CONTENT_STALE");
  });

  test("a confirmation recorded for another stage's folder is not this one's", () => {
    const proj = project();
    const { artifact, questions } = paths(proj);
    confirm(proj, questions);
    writeFileSync(artifact, "# Requirements\n");
    recordArtifactWriteViaHook(proj, artifact, "Write");
    spelledAs(proj, SEVEN, "inception/user-stories/");
    const result = evidence(proj);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.refusal?.code).toBe("SUMMARY_RECEIPT_MISSING");
  });
});

describe("a summary question recorded on a five-phase release and answered after the update", () => {
  test("the answer finds the question it answers", () => {
    const proj = project();
    const { questions } = paths(proj);
    present(proj, questions);
    spelledAs(proj, SEVEN, FIVE);
    const result = answer(proj, questions);
    expect(result.status, result.stderr).toBe(0);
  });

  test("a question recorded for another file is no question about this one", () => {
    const proj = project();
    const { questions } = paths(proj);
    present(proj, questions);
    spelledAs(proj, SEVEN, "inception/user-stories/");
    const result = answer(proj, questions);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("no matching unanswered summary question");
  });
});

describe("a document kept on a five-phase release under the summary confirmation", () => {
  function kept(entry: (path: string) => string) {
    const proj = project();
    const { artifact, questions } = paths(proj);
    // A document already there: the person kept it, so no write follows the confirmation.
    writeFileSync(artifact, "# Requirements\n\n- FR-1: keep the login flow.\n");
    const id = confirm(proj, questions);
    appendAuditEntry("ARTIFACT_REUSED", {
      Stage: STAGE, Decision: "keep", Artifacts: relative(proj, artifact).replaceAll("\\", "/"),
      "Summary Authorization Id": id, "Kept Outputs": entry(artifact),
    }, proj);
    spelledAs(proj, SEVEN, FIVE);
    return { proj, artifact, id };
  }

  test("still descends from that confirmation at the folder it moved to", () => {
    const { proj, artifact, id } = kept((path) => `${sha256(path)} ${SEVEN}requirements.md`);
    expect(summaryOutputDescendsFrom(proj, artifact, id)).toBe(true);
    expect(evidence(proj).ok).toBe(true);
  });

  test("a kept document whose bytes changed since, or another document, does not", () => {
    const changed = kept((path) => `${sha256(path)} ${SEVEN}requirements.md`);
    writeFileSync(changed.artifact, "# Requirements\n\n- FR-1: drop the login flow.\n");
    expect(summaryOutputDescendsFrom(changed.proj, changed.artifact, changed.id)).toBe(false);
    const other = kept((path) => `${sha256(path)} ${SEVEN}other.md`);
    expect(summaryOutputDescendsFrom(other.proj, other.artifact, other.id)).toBe(false);
  });
});

describe("an output's write recorded on a five-phase release", () => {
  const row = (file: string) => ({ event: "ARTIFACT_UPDATED", block: `**Event**: ARTIFACT_UPDATED\n**File**: ${file}\n` });

  test("names the file at the folder it moved to, written from the project or as an absolute path", () => {
    const proj = project();
    const { artifact } = paths(proj);
    const rel = relative(proj, artifact).replaceAll("\\", "/");
    const five = rel.replace(`/${SEVEN}`, `/${FIVE}`);
    expect(five).not.toBe(rel);
    expect(auditRowWritesFile(proj, row(five), artifact)).toBe(true);
    expect(auditRowWritesFile(proj, row(`${proj.replaceAll("\\", "/")}/${five}`), artifact)).toBe(true);
    expect(auditRowWritesFile(proj, row(rel), artifact)).toBe(true);
  });

  test("another file, or another stage's folder, is not this one's write", () => {
    const proj = project();
    const { artifact } = paths(proj);
    const rel = relative(proj, artifact).replaceAll("\\", "/");
    expect(auditRowWritesFile(proj, row(rel.replace(`/${SEVEN}requirements.md`, `/${FIVE}other.md`)), artifact)).toBe(false);
    expect(auditRowWritesFile(proj, row(rel.replace(`/${SEVEN}`, "/inception/user-stories/")), artifact)).toBe(false);
    expect(auditRowWritesFile(proj, { event: "ARTIFACT_REUSED", block: `**File**: ${rel}\n` }, artifact)).toBe(false);
  });
});

describe("a check's result recorded on a five-phase release", () => {
  let pos = 0;
  const result = (event: string, output: string, timestamp: string): AuditShardEvent => ({
    event, timestamp, shard: "audit/host.md", shardIndex: 0, pos: pos++,
    block: `**Event**: ${event}\n**Stage slug**: ${STAGE}\n**Sensor ID**: aidlc-required-sections\n` +
      `**Output path**: ${output}\n**Findings count**: 1\n`,
  });
  const at = (path: string) => `aidlc/spaces/default/intents/x/${path}`;

  test("is the result for the output where it is now, and a later check there replaces it", () => {
    const failed = result("SENSOR_FAILED", at(`${FIVE}requirements.md`), "2026-11-01T10:00:00Z");
    const latest = latestSensorResults([failed], STAGE);
    expect([...latest.keys()]).toEqual([`aidlc-required-sections@${at(`${SEVEN}requirements.md`)}`]);
    expect([...latest.values()][0]).toMatchObject({ kind: "failed", output: at(`${SEVEN}requirements.md`) });
    const passed = result("SENSOR_PASSED", at(`${SEVEN}requirements.md`), "2026-11-02T10:00:00Z");
    expect([...latestSensorResults([failed, passed], STAGE).values()].map((each) => each.kind)).toEqual(["passed"]);
  });

  test("another output keeps its own result", () => {
    const failed = result("SENSOR_FAILED", at(`${FIVE}other.md`), "2026-11-01T10:00:00Z");
    const passed = result("SENSOR_PASSED", at(`${SEVEN}requirements.md`), "2026-11-02T10:00:00Z");
    expect(latestSensorResults([failed, passed], STAGE).size).toBe(2);
  });
});

describe("a claimed Unit's write recorded on a five-phase release", () => {
  const claim = { unit: "alpha", generation: 1, claimed_from_oid: "0".repeat(40) };
  const block = (file: string) =>
    `## ARTIFACT_CREATED\n**Timestamp**: 2026-11-01T10:00:00Z\n**Event**: ARTIFACT_CREATED\n**File**: ${file}\n`;
  const prefix = "aidlc/spaces/default/intents/x";

  test("goes with the Unit's claim, as its moved folders do", () => {
    const rules = claimAuditRules(project(), claim);
    expect(rules.takes(block(`${prefix}/construction/alpha/functional-design/functional-spec.md`))).toBe(true);
    expect(rules.takes(block(`${prefix}/construction/alpha/code-generation/code-generation-plan.md`))).toBe(true);
    expect(rules.takes(block(`${prefix}/design/alpha/functional-design/functional-spec.md`))).toBe(true);
  });

  test("another Unit's write, or one outside the Unit's stage folders, does not", () => {
    const rules = claimAuditRules(project(), claim);
    expect(rules.takes(block(`${prefix}/construction/beta/functional-design/functional-spec.md`))).toBe(false);
    expect(rules.takes(block(`${prefix}/construction/alpha/notes.md`))).toBe(false);
    expect(rules.takes(block(`${prefix}/inception/requirements-analysis/requirements.md`))).toBe(false);
  });
});

describe("a claimed Unit's document written on a five-phase release after its review", () => {
  const fingerprint = `sha256:${"a".repeat(64)}`;
  const row = (event: string, fields: Record<string, string>, pos: number): AuditShardEvent => ({
    event, timestamp: "2026-11-01T10:00:01Z", shard: "a.md", shardIndex: 0, pos,
    block: [`**Event**: ${event}`, "**Timestamp**: 2026-11-01T10:00:01Z",
      ...Object.entries(fields).map(([key, value]) => `**${key}**: ${value}`)].join("\n"),
  });
  const attempt = { Unit: "alpha", "Attempt Generation": "1", Stage: "functional-design", Reviewer: "reviewer", Iteration: "1" };
  const reviewed = [
    row("REVIEW_REQUESTED", { ...attempt, "Artifact Fingerprint": fingerprint }, 0),
    row("REVIEW_COMPLETED", { ...attempt, Verdict: "READY", "Artifact Fingerprint": fingerprint }, 1),
  ];
  const coverage = (file: string) => candidateReviewCoverageProjection([...reviewed, row("ARTIFACT_UPDATED", { File: file }, 2)], {
    unit: "alpha", generation: 1, stage: "functional-design", reviewer: "reviewer",
    artifactPrefix: "design/alpha/functional-design/", expectedFingerprint: fingerprint,
  })?.coverage ?? null;

  test("undoes the review, as the same write at the folder it moved to does", () => {
    expect(coverage("aidlc/construction/alpha/functional-design/functional-spec.md")).toBeNull();
    expect(coverage("aidlc/design/alpha/functional-design/functional-spec.md")).toBeNull();
  });

  test("the Unit's own stage diary, or another Unit's document, leaves it standing", () => {
    expect(coverage("aidlc/construction/alpha/functional-design/memory.md")).toBe("ready");
    expect(coverage("aidlc/construction/beta/functional-design/functional-spec.md")).toBe("ready");
  });
});
