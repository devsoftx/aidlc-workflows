// covers: function:readReviewFindingDispositions, function:hydrateReviewArtifactContexts,
// function:renderFindingsContext, function:pipelineLinkEvidence, function:reviewInvalidationDetails,
// function:currentFingerprintForm, function:inspectStageValidity, function:fivePhaseGraphContracts, audit:STAGE_JUMPED
//
// Records 2.11.4 wrote (State Version 8, five phases), made by driving that
// release's own tools (tests/fixtures/state-v8): a finding the person rejected
// with Request Changes, a Reverse Engineering gate with both pipeline handoffs
// logged, and test-pro's integration stage finished in construction/ with its
// full suite in flight in operation/. Each names its documents at the
// five-phase folders; the 8 to 10 step moves the folders and never rewrites a
// record. After the update each reads as 2.11.4 read it: the decision stays on
// its finding, the handoffs stand and the gate approves, the plugin stage's
// review and completion still hold and its new phase alone is no change to
// what AI-DLC does there, and a backward jump recorded before the
// update still says what it changed. Content stays bound exactly: only the
// recorded paths are read at the folders they moved to.
//
// Mechanism: the shipped engine brings each record up (`next`), then the
// shipped readers, in process or from a test-pro install composed the way
// Claude Code composes it.
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";
import { afterAll, afterEach, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { appendAuditEntry } from "../../dist/claude/.claude/tools/aidlc-audit.ts";
import { artifactFilename, codekbDir, findStageBySlug, pipelineLinkEvidence } from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import {
  hydrateReviewArtifactContexts,
  readReviewArtifactContexts,
  readReviewFindingDispositions,
  renderFindingsContext,
  reviewInvalidationDetails,
} from "../../dist/claude/.claude/tools/aidlc-review-brief.ts";
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

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const V8 = join(REPO_ROOT, "tests", "fixtures", "state-v8");
const RECORD = "aidlc/spaces/default/intents/fixture-8000000000000001";
// The fixture audits hold stage events and no hook heartbeat from this test
// project, which the engine reads as hooks that never ran.
const V8_ENV = { AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" };

const created: string[] = [];
afterEach(() => {
  while (created.length) cleanupTestProject(created.pop());
});

function v8Project(fixture: string, proj = createOrchestrationTestProject()): { proj: string; record: string } {
  created.push(proj);
  const record = seededRecordDir(proj);
  cpSync(join(V8, fixture), record, { recursive: true });
  // 2.11.4 makes every phase folder at creation; git keeps no empty folder.
  for (const folder of ["initialization", "ideation", "inception", "construction", "operation", "verification"]) {
    mkdirSync(join(record, folder), { recursive: true });
  }
  return { proj, record };
}

function next(proj: string, tools = AIDLC_SRC, args: string[] = []) {
  return runOrchestrateNext(join(tools, "tools", "aidlc-orchestrate.ts"), proj, args, { env: { ...process.env, ...V8_ENV } });
}

function tool(proj: string, name: string, args: string[], tools = AIDLC_SRC) {
  const result = spawnSync(process.execPath, [join(tools, "tools", `${name === "aidlc" ? "aidlc" : `aidlc-${name}`}.ts`), ...args, "--project-dir", proj], {
    encoding: "utf-8", cwd: proj, env: { ...process.env, ...V8_ENV }, timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

// Reverse Engineering's documents live in the space's code knowledge base
// under the project's own folder name, outside the record: what 2.11.4's run
// left there, for this project.
function writeCodeKnowledge(proj: string): void {
  const stage = findStageBySlug("reverse-engineering")!;
  const dir = codekbDir(proj, basename(proj));
  mkdirSync(dir, { recursive: true });
  for (const name of stage.produces ?? []) writeFileSync(join(dir, artifactFilename(name)), `# ${name}\n\nThe todo CLI.\n`);
}

describe("a finding the person decided on 2.11.4 stays decided after the update", () => {
  test("Request Changes with R-01 rejected: the next review is told it is settled, and nobody is asked to decide it again", () => {
    const { proj, record } = v8Project("rejected-finding");
    const r = next(proj);
    expect(r.directive?.kind).toBe("run-stage");
    expect(r.directive?.stage).toBe("requirements-analysis");
    expect(existsSync(join(record, "design", "requirements-analysis", "requirements.md"))).toBe(true);
    const stage = findStageBySlug("requirements-analysis")!;
    const artifact = `${RECORD}/design/requirements-analysis/requirements.md`;
    const dispositions = readReviewFindingDispositions(proj, "requirements-analysis");
    expect([...dispositions.values()].map(({ artifact: at, id, status }) => ({ at, id, status }))).toEqual([
      { at: artifact, id: "R-01", status: "Rejected: Internal milestones intentionally have no public date" },
    ]);
    const contexts = hydrateReviewArtifactContexts(readReviewArtifactContexts(proj, stage), dispositions);
    expect(contexts.map((context) => context.findings.map(({ id, status, artifact: at }) => ({ id, status, at }))))
      .toEqual([[{ id: "R-01", status: "Rejected: Internal milestones intentionally have no public date", at: artifact }]]);
    const reviewer = renderFindingsContext(contexts, "reviewer");
    expect(reviewer).toContain("_No open findings require re-checking._");
    expect(reviewer).not.toContain("_No settled decisions are carried into this review._");
    expect(reviewer.slice(reviewer.indexOf("**Decided findings (settled, read-only)**")))
      .toMatch(/^\| R-01 \| Minor \| .*\| Rejected: Internal milestones intentionally have no public date \|$/m);
  });
});

describe("the Reverse Engineering handoffs logged on 2.11.4 hold after the update", () => {
  test("both links stand at the handoff's moved folder, and the gate 2.11.4 left open approves", () => {
    const { proj, record } = v8Project("reverse-engineering-gate");
    writeCodeKnowledge(proj);
    const r = next(proj);
    expect(r.directive?.kind, r.out).toBe("run-stage");
    expect(r.directive?.stage).toBe("reverse-engineering");
    expect(r.directive?.gate).toBe(true);
    expect(existsSync(join(record, "discover", "reverse-engineering", "developer-scan.md"))).toBe(true);
    const stage = findStageBySlug("reverse-engineering")!;
    const evidence = pipelineLinkEvidence(proj, stage);
    expect(evidence.receipts.map((receipt) => receipt.link)).toEqual(["aidlc-developer-agent", "aidlc-architect-agent"]);
    expect(evidence.missing).toEqual([]);
    const approve = tool(proj, "orchestrate", [
      "report", "--stage", "reverse-engineering", "--result", "approved", "--user-input", "Approve",
    ]);
    expect(approve.status, approve.out).toBe(0);
    expect(approve.out).not.toMatch(/handoff|pipeline/i);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \[x\] reverse-engineering — EXECUTE$/m);
  });

  test("an edited handoff is still a change under the scope's Guard Policy strict", () => {
    const { proj, record } = v8Project("reverse-engineering-gate");
    writeCodeKnowledge(proj);
    next(proj);
    expect(readFileSync(seededStateFile(proj), "utf-8")).toMatch(/^- \*\*Guard Policy\*\*: strict \(from scope enterprise\)$/m);
    const handoff = join(record, "discover", "reverse-engineering", "developer-scan.md");
    writeFileSync(handoff, `${readFileSync(handoff, "utf-8")}A line added after the update.\n`);
    const evidence = pipelineLinkEvidence(proj, findStageBySlug("reverse-engineering")!);
    expect(evidence.receipts).toEqual([]);
    expect(evidence.missing.map((entry) => entry.link)).toEqual(["aidlc-developer-agent", "aidlc-architect-agent"]);
  });
});

// A project with the shipped tools and test-pro composed as Claude Code
// composes it.
function testProProject(): string {
  const proj = createOrchestrationTestProject();
  cpSync(AIDLC_SRC, join(proj, ".claude"), { recursive: true });
  const plugin = join(REPO_ROOT, "dist", "plugins", "test-pro", "claude");
  const compose = spawnSync(process.execPath, [join(plugin, "hooks", "compose.ts")], {
    cwd: proj, encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: plugin, CLAUDE_PROJECT_DIR: proj, AIDLC_HARNESS_DIR: ".claude" },
  });
  if (compose.status !== 0) throw new Error(`test-pro compose failed: ${compose.stdout}${compose.stderr}`);
  return proj;
}

// The one test-pro install the first plugin case shares.
let composed = "";
beforeAll(() => {
  composed = testProProject();
});
afterAll(() => {
  if (composed !== "") cleanupTestProject(composed);
});

// `next` from a test-pro install. A session the install knows nothing of may
// ask which work to carry on; the person carries on with this one.
function nextCarryingOn(proj: string, install: string) {
  let r = next(proj, install);
  if (r.directive?.ask_type === "intent-pick") {
    const carryOn = tool(proj, "aidlc", ["engine", "intent", "switch", "fixture-8000000000000001"], install);
    expect(carryOn.status, carryOn.out).toBe(0);
    r = next(proj, install);
  }
  return r;
}

// 2.11.4's own reviewArtifactFingerprint over this fixture's documents, with
// test-pro (as 2.11.4 shipped it) composed: the value a review receipt of each
// stage recorded, hashed under construction/ and operation/.
const RECORDED_REVIEW = {
  "test-pro-integration": "sha256:1ffeaeeba99536b304b95d101804db37bed7e03d8a74fa1f35aa275df64a395b",
  "test-pro-full-suite": "sha256:56e9c98d7755f8816b72a3ef3b35d14bfbf12e557683369e48a9d98b1714f5cd",
};

describe("a plugin stage finished on 2.11.4 holds after its folder moves", () => {
  test("test-pro's stages move to test/ and operate/, the finished one and the one it feeds still hold, and their review fingerprints still match", async () => {
    const { proj, record } = v8Project("plugin-stage", composed);
    created.pop();
    const install = join(composed, ".claude");
    const r = nextCarryingOn(proj, install);
    expect(r.directive?.kind, r.out).toBe("run-stage");
    expect(r.directive?.stage).toBe("test-pro-full-suite");
    for (const path of [
      "test/test-pro-integration/test-pro-integration-test-results.md",
      "operate/test-pro-full-suite/test-pro-full-suite-results.md",
    ]) expect(existsSync(join(record, ...path.split("/"))), path).toBe(true);
    const validity = await import(join(composed, ".claude", "tools", "aidlc-validity.ts"));
    const lib = await import(join(composed, ".claude", "tools", "aidlc-lib.ts"));
    // The receipt check itself: Guard Policy off (the scope's) would let next say nothing either way.
    expect(validity.inspectStageValidity(proj, readFileSync(seededStateFile(proj), "utf-8")).issues).toEqual([]);
    for (const [slug, recorded] of Object.entries(RECORDED_REVIEW)) {
      const stage = lib.loadStageGraphAll().find((entry: { slug: string }) => entry.slug === slug);
      const current = lib.reviewArtifactFingerprint(proj, stage);
      expect(current, slug).not.toBe(recorded);
      expect(lib.currentFingerprintForm(recorded), slug).toBe(current);
    }
    // A document changed since is still a change.
    const results = join(record, "test", "test-pro-integration", "test-pro-integration-test-results.md");
    writeFileSync(results, `${readFileSync(results, "utf-8")}A line added after the update.\n`);
    const stage = lib.loadStageGraphAll().find((entry: { slug: string }) => entry.slug === "test-pro-integration");
    expect(lib.currentFingerprintForm(RECORDED_REVIEW["test-pro-integration"])).not.toBe(lib.reviewArtifactFingerprint(proj, stage));
    const issue = validity.inspectStageValidity(proj, readFileSync(seededStateFile(proj), "utf-8")).issues
      .find((entry: { stage: string }) => entry.stage === "test-pro-integration");
    expect(issue).toMatchObject({ status: "stale", direct: true });
  });

  // 2.11.4 hashed test-pro-integration's graph contract with the phase it had
  // then, construction, and recorded no folder for a plugin's stage; this
  // release ships it in test, and nothing else the receipt hashes changed.
  test("a phase rename alone is no change to the plugin stage: no row and no line says AI-DLC does it differently", async () => {
    const proj = testProProject();
    v8Project("plugin-stage", proj);
    const install = join(proj, ".claude");
    const r = nextCarryingOn(proj, install);
    expect(r.directive?.kind, r.out).toBe("run-stage");
    expect(r.directive?.stage).toBe("test-pro-full-suite");
    const validity = await import(join(install, "tools", "aidlc-validity.ts"));
    const after = validity.inspectStageValidity(proj, readFileSync(seededStateFile(proj), "utf-8"));
    expect(after.issues).toEqual([]);
    expect(after.redefined).toEqual([]);
    expect(after.renewed).toEqual([]);
    const audit = readdirSync(seededAuditDir(proj)).map((file) => readFileSync(join(seededAuditDir(proj), file), "utf-8"));
    expect(audit.join("\n")).not.toMatch(/^\*\*Event\*\*: STAGE_DEFINITION_CHANGED$/m);
    const status = tool(proj, "utility", ["status"], install);
    expect(status.status, status.out).toBe(0);
    expect(status.out).toContain("test-pro-integration");
    expect(status.out).not.toMatch(/differently from when yours ran/);
    // A plugin stage whose contract changed beyond its phase still reads as one AI-DLC now does differently.
    const lib = await import(join(install, "tools", "aidlc-lib.ts"));
    const reworded = lib.loadStageGraphAll().map((entry: { slug: string; condition?: string }) =>
      entry.slug === "test-pro-integration" ? { ...entry, condition: "Runs when the team asks for integration tests" } : entry);
    const changed = validity.inspectStageValidity(proj, readFileSync(seededStateFile(proj), "utf-8"), { stages: reworded });
    expect(changed.redefined.map((entry: { stage: string }) => entry.stage)).toEqual(["test-pro-integration"]);
    expect(changed.issues).toEqual([]);
  });
});

describe("a backward jump recorded on 2.11.4 still says what it changed after the update", () => {
  test("its upstream change and the downstream work to re-check are named at their moved folders", () => {
    const { proj, record } = v8Project("rejected-finding");
    next(proj);
    const stage = findStageBySlug("requirements-analysis")!;
    const contexts = readReviewArtifactContexts(proj, stage);
    // The paths as 2.11.4 wrote them on a jump back from User Stories.
    appendAuditEntry("STAGE_JUMPED", {
      Direction: "BACKWARD",
      Source: "user-stories",
      Target: "requirements-analysis",
      Scope: "feature",
      "Changed Upstream Artifacts": JSON.stringify([`${RECORD}/inception/requirements-analysis/requirements.md`]),
      "Invalidated Downstream Artifacts": JSON.stringify([`${RECORD}/inception/user-stories/stories.md`]),
      "Invalidated Downstream Reviews": JSON.stringify([`${RECORD}/inception/user-stories/stories.md#Review`]),
    }, proj);
    expect(existsSync(join(record, "design", "requirements-analysis", "requirements.md"))).toBe(true);
    expect(reviewInvalidationDetails(proj, stage, contexts)).toEqual({
      changedUpstream: [`${RECORD}/design/requirements-analysis/requirements.md`],
      invalidatedArtifacts: [`${RECORD}/design/user-stories/stories.md`],
      invalidatedReviews: [`${RECORD}/design/user-stories/stories.md#Review`],
    });
  });
});
