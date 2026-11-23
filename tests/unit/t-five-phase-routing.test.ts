// covers: function:stagesReorderedAround, function:fivePhaseReorder, function:stagesOwedBehindCursor, function:owedJumpBack, function:owedRedoNotice, function:bringStateUpToDate, subcommand:aidlc-orchestrate:next, subcommand:aidlc-jump:execute, subcommand:aidlc-utility:recompose
//
// The seven phases walk two stages earlier than 2.11.4 did: Reverse
// Engineering comes before Scope Definition (it came after Approval &
// Handoff), and Performance Validation before Code Review and CI Pipeline (it
// came after Incident Response). A State Version 8 record in flight carries on
// after the 8 to 10 step where 2.11.4 would carry it:
//   - a stage the plan runs that 2.11.4 had still to reach, and that now comes
//     before the cursor, runs once at the next stage boundary (never over an
//     open gate), and the walk then carries on from where it stood without
//     running the stages between that the work had passed over (Code Review
//     and Security Review among them on work already started past them; on
//     work that had only just entered CI Pipeline they run first) and without
//     starting a finished one again, and the line said after the redo names
//     the stage the person meets next;
//   - a stage 2.11.4 had passed over that now comes after the cursor stays
//     passed over;
//   - a forward jump since the update that 2.11.4 would have made past the
//     owed stage passes it over, as 2.11.4's jump did, and a skip takes it off.
// Each record is a real one 2.11.4 wrote (tests/fixtures/state-v8), made by
// driving that release's own state tool, jump and scope change; the walks the
// tests expect are the ones that release takes on the same record, with the
// owed stage run at the boundary.
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
import { FIVE_PHASE_STAGE_ORDER, stagesReorderedAround } from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import { loadStageGraph } from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { fivePhaseReorder } from "../../dist/claude/.claude/tools/aidlc-seven-phase-upgrade.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const BUN = process.execPath;
const TOOLS = join(AIDLC_SRC, "tools");
const V8 = join(REPO_ROOT, "tests", "fixtures", "state-v8");
const FIVE_PHASE_FOLDERS = ["ideation", "inception", "construction", "operation"];
// The fixture audits hold no hook heartbeat from this test project, and the
// walk approves by the state tool's own transitions, as the generator did.
const ENV = {
  ...process.env,
  AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1",
  AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS: "1",
  AIDLC_SKIP_SOURCE_FRESHNESS: "1",
  AIDLC_SKIP_ARTIFACT_GUARD: "1",
  AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD: "1",
  AIDLC_SKIP_REVISION_BACKSTOP: "1",
  AIDLC_SKIP_REVIEWER_GATE_GUARD: "1",
  AIDLC_DISABLE_PLAN_APPROVAL_GUARD: "1",
};

const created: string[] = [];
afterEach(() => {
  while (created.length) cleanupTestProject(created.pop());
});

function v8Project(fixture: string): string {
  const proj = createOrchestrationTestProject();
  created.push(proj);
  const record = seededRecordDir(proj);
  cpSync(join(V8, fixture), record, { recursive: true });
  // 2.11.4 makes every phase folder at creation; git keeps no empty folder.
  for (const folder of ["initialization", ...FIVE_PHASE_FOLDERS, "verification"]) mkdirSync(join(record, folder), { recursive: true });
  return proj;
}

function tool(proj: string, name: string, args: string[]): { status: number; out: string; stdout: string } {
  const r = spawnSync(BUN, [join(TOOLS, name), ...args, "--project-dir", proj], {
    encoding: "utf-8", env: ENV, timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
}

function next(proj: string): Record<string, unknown> {
  return runOrchestrateNext(join(TOOLS, "aidlc-orchestrate.ts"), proj, [], { env: ENV }).directive ?? {};
}

function state(proj: string): string {
  return readFileSync(seededStateFile(proj), "utf-8");
}

function box(proj: string, slug: string): string | undefined {
  return new RegExp(`^- \\[(.)\\] ${slug} —`, "m").exec(state(proj))?.[1];
}

// Every audit row of the record, as one text.
function audit(proj: string): string {
  const dir = seededAuditDir(proj);
  return readdirSync(dir).map((file) => readFileSync(join(dir, file), "utf-8")).join("\n");
}

function upgradeRow(proj: string): string {
  const rows = audit(proj).split(/^(?=## )/m).filter((block) => /^\*\*Event\*\*: STATE_UPGRADED$/m.test(block));
  expect(rows.length).toBe(1);
  return rows[0];
}

// The rows of one event for one stage written since the update: this release
// writes them to this checkout's own audit file, never to one 2.11.4 wrote.
function rowsSinceUpgrade(proj: string, event: string, slug: string): number {
  const dir = seededAuditDir(proj);
  const upgraded = readdirSync(dir).map((file) => readFileSync(join(dir, file), "utf-8"))
    .filter((text) => /^\*\*Event\*\*: STATE_UPGRADED$/m.test(text));
  expect(upgraded.length).toBe(1);
  return upgraded[0].split(/^(?=## )/m)
    .filter((block) => new RegExp(`^\\*\\*Event\\*\\*: ${event}$`, "m").test(block) && new RegExp(`^\\*\\*Stage\\*\\*: ${slug}$`, "m").test(block))
    .length;
}

// Reverse Engineering's documenting is recorded as handed to the developer
// agent, as a run records it.
function documentTheCode(proj: string): void {
  const dir = join(seededRecordDir(proj), "discover", "reverse-engineering");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "developer-scan.md"), "# Developer scan\n\nsrc/todo.ts holds the todo list.\n");
  const link = tool(proj, "aidlc-log.ts", ["link", "--stage", "reverse-engineering", "--link", "aidlc-developer-agent", "--artifact", join(dir, "developer-scan.md")]);
  expect(link.status, link.out).toBe(0);
}

interface Walk {
  // Each stage `next` put in front of the person, in order; an open gate shown
  // as it stood is marked "(gate)".
  stages: string[];
  // The jump each owed stage was run with, and the stages it marked passed over.
  jumps: { command: string; skipped: string[] }[];
  // Every line the walk had the agent say to the person: a jump's line rides
  // the next step the agent speaks from, or the jump's own output.
  said: string[];
  ended: string;
  changed: unknown[];
}

// Walks the work the way the conductor does: `next`, the jump a print names,
// each stage approved at its gate, until the work is done or `stop` is shown.
function walk(proj: string, stop?: string): Walk {
  const out: Walk = { stages: [], jumps: [], said: [], ended: "", changed: [] };
  for (let step = 0; step < 30; step++) {
    const d = next(proj);
    if (d.stage_validity !== undefined) out.changed.push(d.stage_validity);
    out.said.push(...((d.change_notices as string[] | undefined) ?? []));
    if (d.kind === "print") {
      const jump = /execute --target (\S+) --direction (\w+)/.exec(String(d.message));
      expect(jump, String(d.message)).not.toBeNull();
      const [, target, direction] = jump as RegExpExecArray;
      const ran = tool(proj, "aidlc-jump.ts", ["execute", "--target", target, "--direction", direction]);
      expect(ran.status, ran.out).toBe(0);
      const result = JSON.parse(ran.stdout.trim()) as { notice?: string; stages_skipped: string[] };
      if (result.notice !== undefined) out.said.push(result.notice);
      out.jumps.push({ command: `${target} ${direction}`, skipped: result.stages_skipped });
      continue;
    }
    if (d.kind !== "run-stage" || typeof d.stage !== "string") {
      out.ended = String(d.kind);
      return namesWhatFollowsTheRedo(out);
    }
    const slug = d.stage;
    out.stages.push(d.gate_only === true ? `${slug} (gate)` : slug);
    if (slug === stop) {
      out.ended = "stopped";
      return namesWhatFollowsTheRedo(out);
    }
    if (slug === "reverse-engineering") documentTheCode(proj);
    if (box(proj, slug) === "-") expect(tool(proj, "aidlc-state.ts", ["gate-start", slug]).status).toBe(0);
    const approved = tool(proj, "aidlc-state.ts", ["approve", slug, "--user-input", "approve"]);
    expect(approved.status, approved.out).toBe(0);
  }
  throw new Error(`the walk did not end: ${out.stages.join(", ")}`);
}

const STAGE_NAMES = new Map(loadStageGraph().map((stage) => [stage.slug, stage.name]));

// The line a redo has the agent say names the stage the person meets once
// they approve its target: the one the walk shows next.
function namesWhatFollowsTheRedo(out: Walk): Walk {
  for (const { command } of out.jumps) {
    const [target, direction] = command.split(" ");
    const after = out.stages[out.stages.indexOf(target) + 1];
    if (direction !== "redo" || !out.stages.includes(target) || after === undefined) continue;
    const name = STAGE_NAMES.get(after.replace(/ \(gate\)$/, ""));
    expect(out.said.some((line) => line.startsWith("Once you approve ") && line.endsWith(` ${name}.`)), `${after}: ${out.said.join(" | ")}`)
      .toBe(true);
  }
  return out;
}

const ORDER = loadStageGraph().map((stage) => stage.slug);

describe("the order 2.11.4 walked in, and what the seven phases do to it", () => {
  test("the frozen order is 2.11.4's own stage order after Initialization", () => {
    // Read from 2.11.4's compiled stage graph, numbers 1.1 to 4.7.
    expect(FIVE_PHASE_STAGE_ORDER).toEqual([
      "intent-capture", "market-research", "feasibility", "scope-definition", "team-formation", "rough-mockups",
      "approval-handoff", "reverse-engineering", "practices-discovery", "requirements-analysis", "user-stories",
      "refined-mockups", "domain-design", "units-generation", "contract-design", "delivery-planning",
      "functional-design", "nfr-requirements", "nfr-design", "infrastructure-design", "code-generation",
      "build-and-test", "ci-pipeline", "deployment-pipeline", "environment-provisioning", "deployment-execution",
      "observability-setup", "incident-response", "performance-validation", "feedback-optimization",
    ]);
  });

  test("Performance Validation and Reverse Engineering are the two stages walked earlier now", () => {
    for (const cursor of ["ci-pipeline", "deployment-pipeline", "environment-provisioning", "deployment-execution", "observability-setup", "incident-response"]) {
      expect(stagesReorderedAround(ORDER, cursor), cursor).toEqual({ behind: ["performance-validation"], ahead: [] });
    }
    for (const cursor of ["scope-definition", "team-formation", "rough-mockups", "approval-handoff"]) {
      expect(stagesReorderedAround(ORDER, cursor), cursor).toEqual({ behind: ["reverse-engineering"], ahead: [] });
    }
    // At the moved stage itself, the stages 2.11.4 had passed now come after it;
    // the Secure stages stand where 2.11.4 would have reached them, before CI Pipeline.
    expect(stagesReorderedAround(ORDER, "performance-validation")).toEqual({
      behind: [],
      ahead: [
        "code-review", "security-review", "conformance-review", "ci-pipeline", "deployment-pipeline",
        "environment-provisioning", "deployment-execution", "observability-setup", "incident-response",
      ],
    });
    expect(stagesReorderedAround(ORDER, "reverse-engineering")).toEqual({
      behind: [],
      ahead: ["scope-definition", "team-formation", "rough-mockups", "approval-handoff"],
    });
    for (const cursor of ["state-init", "intent-capture", "practices-discovery", "code-generation", "build-and-test", "feedback-optimization", "none"]) {
      expect(stagesReorderedAround(ORDER, cursor), cursor).toEqual({ behind: [], ahead: [] });
    }
  });

  test("a record already in the seven-phase layout is not reordered", () => {
    const proj = v8Project("pv-deploy-entered");
    const five = state(proj);
    expect(fivePhaseReorder(five)).toEqual({ movedBehind: ["performance-validation"], keptPassedOver: [] });
    next(proj);
    expect(fivePhaseReorder(state(proj).replace(/^- \*\*State Version\*\*: 10$/m, "- **State Version**: 8")))
      .toEqual({ movedBehind: [], keptPassedOver: [] });
  });
});

describe("a stage 2.11.4 had still to reach runs once, then the walk returns where it stood", () => {
  test("at Incident Response's open gate: the gate first, Performance Validation once it is approved, then Feedback & Optimization", () => {
    const proj = v8Project("pv-incident-gate");
    expect(next(proj).gate_only).toBe(true);
    // What status names as next is the stage that does run after the gate, as 2.11.4 named it.
    expect(state(proj)).toMatch(/^- \*\*Next Stage\*\*: performance-validation$/m);
    const r = walk(proj);
    // 2.11.4 walks this record Incident Response, Performance Validation, Feedback & Optimization.
    expect(r.stages).toEqual(["incident-response (gate)", "performance-validation", "feedback-optimization"]);
    expect(r.ended).toBe("done");
    expect(r.changed).toEqual([]);
    const row = upgradeRow(proj);
    expect(row).toMatch(/^\*\*Stages moved behind\*\*: performance-validation$/m);
    expect(row).toMatch(/^\*\*Stages passed over\*\*: none$/m);
    // The redo ran once the gate was settled, from Feedback & Optimization, and
    // left the Secure stages this work had already passed as passed over. The
    // one line said is where the walk goes after it.
    expect(r.jumps).toEqual([{ command: "performance-validation redo", skipped: ["code-review", "security-review"] }]);
    expect(r.said).toEqual(["Once you approve Performance Validation, we're back at Feedback & Optimization."]);
    expect(rowsSinceUpgrade(proj, "STAGE_STARTED", "performance-validation")).toBe(1);
    expect(rowsSinceUpgrade(proj, "STAGE_COMPLETED", "performance-validation")).toBe(1);
    for (const slug of ["ci-pipeline", "deployment-pipeline", "environment-provisioning", "deployment-execution", "observability-setup"]) {
      expect(box(proj, slug), slug).toBe("x");
      expect(rowsSinceUpgrade(proj, "STAGE_STARTED", slug), slug).toBe(0);
    }
    expect(state(proj)).toMatch(/^- \*\*Status\*\*: Completed$/m);
    // Going back for it and returning reset no phase the work had finished.
    expect(state(proj)).toMatch(/^- \*\*Deploy\*\*: Verified$/m);
    expect(state(proj)).toMatch(/^- \*\*Secure\*\*: Skipped$/m);
  });

  test("just entered Deployment Execution: Performance Validation runs now, then Deployment Execution and the rest, and nothing finished starts again", () => {
    const proj = v8Project("pv-deploy-entered");
    const first = next(proj);
    expect(first.kind).toBe("print");
    expect(String(first.message)).toContain("execute --target performance-validation --direction redo --scope feature");
    expect(String(first.message)).toContain("the workflow returns to deployment-execution after it");
    const r = walk(proj);
    expect(r.stages).toEqual([
      "performance-validation", "deployment-execution", "observability-setup", "incident-response", "feedback-optimization",
    ]);
    expect(r.ended).toBe("done");
    expect(r.changed).toEqual([]);
    expect(r.jumps).toEqual([{ command: "performance-validation redo", skipped: ["code-review", "security-review"] }]);
    expect(r.said).toEqual(["Once you approve Performance Validation, we're back at Deployment Execution."]);
    for (const slug of ["ci-pipeline", "deployment-pipeline", "environment-provisioning"]) {
      expect(box(proj, slug), slug).toBe("x");
      expect(rowsSinceUpgrade(proj, "STAGE_STARTED", slug), slug).toBe(0);
    }
    expect(rowsSinceUpgrade(proj, "STAGE_STARTED", "performance-validation")).toBe(1);
  });

  test("just entered CI Pipeline: Performance Validation, then the Secure reviews the work had only just passed, then CI Pipeline on", () => {
    const proj = v8Project("pv-ci-entered");
    const r = walk(proj);
    expect(r.stages).toEqual([
      "performance-validation", "code-review", "security-review", "ci-pipeline", "deployment-pipeline",
      "environment-provisioning", "deployment-execution", "observability-setup", "incident-response", "feedback-optimization",
    ]);
    expect(r.ended).toBe("done");
    expect(r.changed).toEqual([]);
    expect(r.jumps).toEqual([{ command: "performance-validation redo", skipped: [] }]);
    // The work had only just entered CI Pipeline, so the line names Code Review, which comes first.
    expect(r.said).toEqual(["Once you approve Performance Validation, the work goes on to Code Review."]);
    expect(upgradeRow(proj)).toMatch(/^\*\*Stages moved behind\*\*: performance-validation$/m);
    expect(rowsSinceUpgrade(proj, "STAGE_STARTED", "performance-validation")).toBe(1);
    expect(box(proj, "build-and-test")).toBe("x");
    expect(rowsSinceUpgrade(proj, "STAGE_STARTED", "build-and-test")).toBe(0);
  });

  test("a brownfield record at Scope Definition's open gate: the gate first, Reverse Engineering once it is approved, then Team Formation", () => {
    const proj = v8Project("brownfield-scope-gate");
    const first = next(proj);
    // 2.11.4 shows this gate; nothing is run in front of it.
    expect(first.kind).toBe("run-stage");
    expect(first.stage).toBe("scope-definition");
    expect(first.gate_only).toBe(true);
    expect(first.stage_validity).toBeUndefined();
    expect(box(proj, "scope-definition")).toBe("?");
    expect(upgradeRow(proj)).toMatch(/^\*\*Stages moved behind\*\*: reverse-engineering$/m);
    const r = walk(proj, "rough-mockups");
    expect(r.stages).toEqual(["scope-definition (gate)", "reverse-engineering", "team-formation", "rough-mockups"]);
    expect(r.changed).toEqual([]);
    expect(r.jumps).toEqual([{ command: "reverse-engineering redo", skipped: [] }]);
    expect(r.said).toEqual(["Once you approve the code's documentation, we're back at Team Formation."]);
    // Scope Definition was approved once, at its own gate, and never started again.
    expect(box(proj, "scope-definition")).toBe("x");
    expect(rowsSinceUpgrade(proj, "STAGE_STARTED", "scope-definition")).toBe(0);
    expect(rowsSinceUpgrade(proj, "STAGE_COMPLETED", "scope-definition")).toBe(1);
    expect(box(proj, "reverse-engineering")).toBe("x");
  });
});

describe("a stage 2.11.4 had passed over stays passed over", () => {
  test("at Performance Validation after a scope change: CI Pipeline, Environment Provisioning and the Secure reviews are not run", () => {
    const proj = v8Project("pv-mirror");
    const before = state(proj);
    // 2.11.4 left these two on the plan behind Performance Validation, not run.
    for (const slug of ["ci-pipeline", "environment-provisioning"]) {
      expect(before).toMatch(new RegExp(`^- \\[ \\] ${slug} — EXECUTE$`, "m"));
    }
    const r = walk(proj);
    // 2.11.4 walks this record Performance Validation, Feedback & Optimization.
    expect(r.stages).toEqual(["performance-validation", "feedback-optimization"]);
    expect(r.ended).toBe("done");
    expect(r.jumps).toEqual([]);
    expect(r.said).toEqual([]);
    expect(r.changed).toEqual([]);
    const now = state(proj);
    for (const slug of ["code-review", "security-review", "ci-pipeline", "environment-provisioning"]) {
      expect(now, slug).toMatch(new RegExp(`^- \\[S\\] ${slug} — EXECUTE$`, "m"));
      expect(rowsSinceUpgrade(proj, "STAGE_STARTED", slug), slug).toBe(0);
    }
    const row = upgradeRow(proj);
    expect(row).toMatch(/^\*\*Stages moved behind\*\*: none$/m);
    expect(row).toMatch(/^\*\*Stages passed over\*\*: code-review, security-review, ci-pipeline, environment-provisioning$/m);
  });

  test("Code Review and Security Review, which the work had passed, stay passed over after the owed stage runs", () => {
    const proj = v8Project("pv-deploy-entered");
    walk(proj);
    for (const slug of ["code-review", "security-review"]) {
      expect(box(proj, slug), slug).toBe("S");
      expect(rowsSinceUpgrade(proj, "STAGE_STARTED", slug), slug).toBe(0);
    }
  });
});

describe("the person's own move past an owed stage", () => {
  test("a forward jump 2.11.4 would have made past Performance Validation passes it over; a shorter one does not", () => {
    const far = v8Project("pv-deploy-entered");
    expect(next(far).kind).toBe("print");
    const jumped = tool(far, "aidlc-jump.ts", ["execute", "--target", "feedback-optimization", "--direction", "forward"]);
    expect(jumped.status, jumped.out).toBe(0);
    const afterFar = next(far);
    expect(afterFar.kind).toBe("run-stage");
    expect(afterFar.stage).toBe("feedback-optimization");
    expect(box(far, "performance-validation")).toBe(" ");

    const near = v8Project("pv-deploy-entered");
    next(near);
    expect(tool(near, "aidlc-jump.ts", ["execute", "--target", "incident-response", "--direction", "forward"]).status).toBe(0);
    const afterNear = next(near);
    expect(afterNear.kind).toBe("print");
    expect(String(afterNear.message)).toContain("execute --target performance-validation --direction redo");
    expect(String(afterNear.message)).toContain("the workflow returns to incident-response after it");
  });

  test("a skip of the owed stage takes it off the plan, and the work goes on where it stood", () => {
    const proj = v8Project("pv-deploy-entered");
    expect(next(proj).kind).toBe("print");
    const skip = tool(proj, "aidlc-utility.ts", ["recompose", "--skip", "performance-validation", "--reason", "the person asked to skip it"]);
    expect(skip.status, skip.out).toBe(0);
    expect(state(proj)).toMatch(/^- \[ \] performance-validation — SKIP$/m);
    const after = next(proj);
    expect(after.kind).toBe("run-stage");
    expect(after.stage).toBe("deployment-execution");
    expect(existsSync(join(seededRecordDir(proj), "test", "performance-validation"))).toBe(false);
  });
});
