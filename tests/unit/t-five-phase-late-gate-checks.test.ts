// covers: subcommand:aidlc-state:gate-start, subcommand:aidlc-state:checkpoint-checks, audit:CHECKPOINT_VERIFICATION_RECORDED
//
// In solo work built Unit by Unit with checkpoints, a team's blocking gate
// check runs at each Unit's checkpoint, and the verification row records the
// files it read by path and hash (Checked Outputs); the late stage gate the
// engine settles itself leaves out what a checkpoint checked while the file is
// as it was. A five-phase AI-DLC (2.11.4) recorded those paths at
// construction/<unit>/<stage>/, and the 8 to 10 step moves the files and never
// rewrites the row: the late gate still reads them as checked, so a Unit
// approved before the update is not checked, or asked about, again. A file
// changed since is still checked.
//
// Mechanism: the shipped review logger, checkpoint and state tools on a
// scratch project, with a team check that logs each file it reads, and the
// verification row given the spelling 2.11.4 wrote.
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";
import { afterAll, afterEach, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import {
  _resetStageGraphForTests,
  artifactFilename,
  findStageBySlug,
  latestMainWorkflowStageRunFloorForProject,
  loadStageGraphAll,
  reviewArtifactFingerprint,
} from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import {
  AIDLC_SRC, cleanupTestProject, createTestProject, seedAidlcMemory, seedBoltDag, seededAuditDir, seededRecordDir,
  seededStateFile,
} from "../harness/fixtures.ts";
import { phaseFor } from "../harness/stage-phase.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const STAGES = ["functional-design", "nfr-requirements", "nfr-design", "infrastructure-design", "code-generation"];
const SEPARATOR = "—";
const CHECK = "retention";
const priorEnv: Record<string, string | undefined> = {};
let seams = "";
let fired = "";

// The team's blocking check on Code Generation, and no other check: a graph
// with it bound, its manifest, and its script, which passes and logs the file
// it was fired on.
beforeAll(() => {
  seams = mkdtempSync(join(tmpdir(), "aidlc-late-gate-"));
  fired = join(seams, "fired.log");
  const sensors = join(seams, "sensors");
  const scripts = join(seams, "scripts");
  mkdirSync(sensors, { recursive: true });
  mkdirSync(scripts, { recursive: true });
  writeFileSync(join(sensors, `aidlc-${CHECK}.md`), [
    "---", `id: ${CHECK}`, "kind: deterministic", `command: bun .claude/tools/aidlc-sensor-${CHECK}.ts`,
    "default_severity: blocking", "description: The team's check on a Unit's code", "category: document-shape",
    "fire_on: gate", 'matches: "**/intents/**"', "input_schema:", "  output_path: string", "  stage_slug: string",
    "output_schema:", "  pass: boolean", "  findings: string[]", "  findings_count: number", "timeout_seconds: 60",
    "---", "", `# ${CHECK}`, "",
  ].join("\n"));
  writeFileSync(join(scripts, `aidlc-sensor-${CHECK}.ts`), [
    'import { appendFileSync } from "node:fs";',
    "export function main(argv: string[]): void {",
    '  const outputPath = argv[argv.indexOf("--output-path") + 1].replaceAll("\\\\", "/");',
    '  appendFileSync(process.env.AIDLC_TEST_CHECK_LOG!, outputPath + "\\n");',
    '  console.log(JSON.stringify({ pass: true, findings: [], findings_count: 0 }));',
    "}",
    "if (import.meta.main) main(process.argv.slice(2));",
    "",
  ].join("\n"));
  const graph = loadStageGraphAll().map((stage) => ({
    ...stage,
    sensors_applicable: stage.slug === "code-generation"
      ? [{ id: CHECK, path: `.claude/sensors/aidlc-${CHECK}.md`, fire_on: "gate", default_severity: "blocking", category: "document-shape", matches: "**/intents/**" }]
      : [],
  }));
  writeFileSync(join(seams, "stage-graph.json"), JSON.stringify(graph));
  const env = {
    AIDLC_STAGE_GRAPH: join(seams, "stage-graph.json"),
    AIDLC_SENSORS_DIR: sensors,
    AIDLC_SENSOR_SCRIPT_DIR: scripts,
    AIDLC_TEST_CHECK_LOG: fired,
  };
  for (const [name, value] of Object.entries(env)) {
    priorEnv[name] = process.env[name];
    process.env[name] = value;
  }
  _resetStageGraphForTests();
});

afterAll(() => {
  for (const [name, value] of Object.entries(priorEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  _resetStageGraphForTests();
  if (seams !== "") rmSync(seams, { recursive: true, force: true });
});

const projects: string[] = [];
afterEach(() => {
  while (projects.length) cleanupTestProject(projects.pop());
});

// Classic, solo, one Unit, advisory reviews, checkpoints on, Unit by Unit.
function fixture(policy: string): string {
  const p = createTestProject();
  projects.push(p);
  seedAidlcMemory(p);
  writeFileSync(seededStateFile(p), `# AI-DLC State Tracking
## Project Information
- **Project**: A Unit checked at its checkpoint before the update
- **Project Type**: Greenfield
- **Project Type Source**: you
- **Scope**: classic
- **State Version**: 10
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
${STAGES.slice(0, 4).map((stage) => `- [${stage === "functional-design" ? "-" : " "}] ${stage} ${SEPARATOR} EXECUTE`).join("\n")}
### BUILD PHASE
- [ ] code-generation ${SEPARATOR} EXECUTE
### TEST PHASE
- [ ] build-and-test ${SEPARATOR} EXECUTE
## Current Status
- **Lifecycle Phase**: DESIGN
- **Current Stage**: functional-design
- **Status**: Running
`);
  seedBoltDag(p, ["alpha"]);
  mkdirSync(join(p, "src"), { recursive: true });
  writeFileSync(join(p, "src", "alpha.ts"), "export const alpha = 1;\n");
  appendAuditEntry("WORKFLOW_STARTED", { Scope: "classic" }, p);
  return p;
}

function unitDir(p: string, slug: string): string {
  return join(seededRecordDir(p), phaseFor(slug), "alpha", slug);
}

function tool(p: string, name: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(process.execPath, [join(AIDLC_SRC, `tools/aidlc-${name}.ts`), ...args, "--project-dir", p], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", env,
  });
  return { status: result.status, stdout: result.stdout, out: `${result.stdout}${result.stderr}` };
}

function human(p: string, prompt: string, session: string): void {
  const env: NodeJS.ProcessEnv = { ...process.env, AIDLC_PROJECT_DIR: p, CLAUDE_PROJECT_DIR: p };
  delete env.AIDLC_SKIP_HUMAN_PRESENCE_GUARD;
  delete env.AIDLC_UNATTENDED;
  const result = spawnSync(process.execPath, [join(AIDLC_SRC, "tools/aidlc.ts"), "engine", "hook", "record-human-turn"], {
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8", cwd: p, env,
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: session, prompt }),
  });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
}

// The Unit's stages built as a run records them: outputs, a review through
// the logger, completion.
function build(p: string): void {
  for (const slug of STAGES) {
    const stage = findStageBySlug(slug)!;
    const dir = unitDir(p, slug);
    mkdirSync(dir, { recursive: true });
    for (const name of stage.produces ?? []) writeFileSync(join(dir, artifactFilename(name)), `# alpha ${name}\n`);
    if (stage.workspace_requires) {
      writeFileSync(join(dir, "source-manifest.json"), JSON.stringify({
        stage: slug, unit: "alpha", version: 1, writes: [{ path: "src/alpha.ts" }],
      }));
    }
    const args = ["review", "--stage", slug, "--reviewer", stage.reviewer!, "--unit", "alpha", "--iteration", "1"];
    const requested = tool(p, "log", args);
    expect(requested.status, requested.out).toBe(0);
    const request = JSON.parse(requested.stdout.trim().split(/\r?\n/).at(-1)!) as { reviewFile: string };
    mkdirSync(dirname(join(p, request.reviewFile)), { recursive: true });
    writeFileSync(join(p, request.reviewFile), `**Verdict:** READY\n**Reviewer:** ${stage.reviewer}\n**Iteration:** 1\n\n### Findings\n\nNo blocking findings.\n`);
    const recorded = tool(p, "log", [...args, "--verdict", "READY"]);
    expect(recorded.status, recorded.out).toBe(0);
    const floor = latestMainWorkflowStageRunFloorForProject(p, slug, true, "alpha");
    appendAuditEntry("UNIT_COMPLETED", stage.workspace_requires ? { Stage: slug, Unit: "alpha", "Run floor": floor } : {
      Stage: slug, Unit: "alpha", Mode: "wave", "Run floor": floor,
      "Artifact Fingerprint": reviewArtifactFingerprint(p, stage, "alpha", { requireRequiredArtifacts: true })!,
    }, p);
  }
}

// The Unit's checkpoint, verified (its checks run), asked and approved by the person.
function approve(p: string): void {
  const script = join(seededRecordDir(p), "check.cjs");
  writeFileSync(script, "process.exit(0);");
  const quote = (value: string) => process.platform === "win32" ? `"${value.replaceAll('"', '""')}"` : `'${value.replaceAll("'", "'\\''")}'`;
  const command = `${quote(process.execPath)} ${quote(script)}`;
  const identity = ["--stage", "code-generation", "--checkpoint", "verification-command", "--command", command, "--session", "t-late-command"];
  const skip = { ...process.env, AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" };
  expect(tool(p, "log", ["decision", ...identity, "--decision", "Use this command to verify each completed Unit?", "--options", "Approve,Request Changes"], skip).status).toBe(0);
  human(p, "Approve", "t-late-command");
  expect(tool(p, "log", ["answer", ...identity, "--details", "Approve"], skip).status).toBe(0);
  expect(tool(p, "state", ["set-construction-verification-command", command], skip).status).toBe(0);
  const checkpoint = (args: string[]) => {
    const result = tool(p, "bolt", ["checkpoint", "--unit", "alpha", "--kind", "unit", ...args]);
    expect(result.status, result.out).toBe(0);
    return JSON.parse(result.stdout);
  };
  expect(checkpoint(["--action", "verify"]).verified).toBe(true);
  checkpoint(["--action", "ask", "--session", "t-late-alpha"]);
  human(p, "Approve", "t-late-alpha");
  expect(checkpoint(["--action", "approve", "--session", "t-late-alpha", "--user-input", "Approve"]).approved).toBe(true);
}

// The verification row's Checked Outputs as 2.11.4 wrote them: each Unit
// file at construction/<unit>/<stage>/.
function checkedAsFivePhase(p: string): void {
  const audit = seededAuditDir(p);
  let rewritten = 0;
  for (const name of readdirSync(audit)) {
    const path = join(audit, name);
    const text = readFileSync(path, "utf-8");
    const five = text.replace(/^\*\*Checked Outputs\*\*: .*$/gm, (line) => {
      rewritten++;
      return line.replaceAll("/build/alpha/code-generation/", "/construction/alpha/code-generation/");
    });
    if (five !== text) writeFileSync(path, five);
  }
  expect(rewritten).toBe(1);
}

function toCodeGeneration(p: string): void {
  const state = seededStateFile(p);
  writeFileSync(state, readFileSync(state, "utf-8")
    .replace(/^- \[[- ]\] (functional-design|nfr-requirements|nfr-design|infrastructure-design) /gm, "- [x] $1 ")
    .replace(/^- \[ \] code-generation /m, "- [-] code-generation ")
    .replace(/^- \*\*Lifecycle Phase\*\*: DESIGN$/m, "- **Lifecycle Phase**: BUILD")
    .replace(/^- \*\*Current Stage\*\*: functional-design$/m, "- **Current Stage**: code-generation"));
}

// The late gate as the engine opens it, its own transition allowed.
const gateEnv = (): NodeJS.ProcessEnv => ({ ...process.env, AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1", AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS: "1",
  AIDLC_SKIP_SOURCE_FRESHNESS: "1" });

function firedOn(): string[] {
  return existsSync(fired) ? readFileSync(fired, "utf-8").split("\n").filter((line) => line !== "") : [];
}

// The Unit built and approved at its checkpoint, whose check read its files;
// the row then spelled as 2.11.4 wrote it, and the walk at the late gate.
function checkedOnFivePhase(policy: string, between: (p: string) => void = () => {}): string {
  const p = fixture(policy);
  build(p);
  approve(p);
  const atCheckpoint = firedOn();
  expect(atCheckpoint.some((path) => path.endsWith("/build/alpha/code-generation/code-summary.md")), atCheckpoint.join("\n")).toBe(true);
  between(p);
  checkedAsFivePhase(p);
  toCodeGeneration(p);
  rmSync(fired, { force: true });
  const gate = tool(p, "state", ["gate-start", "code-generation"], gateEnv());
  expect(gate.status, gate.out).toBe(0);
  return p;
}

describe("the late stage gate after a Unit's checkpoint checked its files on 2.11.4", () => {
  test("does not check that Unit's files again while they are as they were", () => {
    checkedOnFivePhase("strict (set by you)");
    expect(firedOn()).toEqual([]);
  });

  test("checks a file changed since the checkpoint, and only that one", () => {
    let summary = "";
    // Under Guard Policy off the Unit's approval stands over the edit, and the file's own hash decides.
    checkedOnFivePhase("off (set by you)", (p) => {
      summary = join(unitDir(p, "code-generation"), "code-summary.md");
      writeFileSync(summary, `${readFileSync(summary, "utf-8")}A line added after the checkpoint.\n`);
    });
    expect(firedOn()).toEqual([summary.replaceAll("\\", "/")]);
  });
});
