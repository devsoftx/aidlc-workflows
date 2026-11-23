// covers: function:sevenPhaseRecordPath, function:sameRecordPath, function:fivePhaseLogicalPath,
// function:rememberFivePhaseFingerprint, function:fivePhaseFingerprintForm
//
// A five-phase AI-DLC (State Version 8, up to 2.11.4) kept each stage's record
// under ideation/, inception/, construction/ or operation/, and a Unit's work
// under construction/<unit>/<stage>/. The 8 to 10 state step moves those
// folders to the seven-phase layout, and every reader of recorded evidence (a
// questions file on an approval or a summary, an audit row's File, a review
// manifest's logical paths) reads the five-phase spelling through this one
// table. Only the recorded side is ever translated: a current path is compared
// as it is, and a path that only looks like a five-phase one stays as it was.
import { describe, expect, test } from "bun:test";
import {
  FIVE_PHASE_STAGE_FOLDER,
  fivePhaseFingerprintForm,
  fivePhaseLogicalPath,
  rememberFivePhaseFingerprint,
  sameRecordPath,
  SEVEN_PHASE_STAGE_FOLDER,
  sevenPhaseRecordPath,
} from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import { loadStageGraphAll } from "../../dist/claude/.claude/tools/aidlc-lib.ts";

const RECORD = "aidlc/spaces/default/intents/fixture-8000000000000001";

describe("a five-phase record path reads in its seven-phase spelling", () => {
  test("each stage-level folder goes where the 8 to 10 step moves it", () => {
    const cases: Array<[string, string]> = [
      ["ideation/feasibility/feasibility-assessment.md", "discover/feasibility/feasibility-assessment.md"],
      ["inception/reverse-engineering/developer-scan.md", "discover/reverse-engineering/developer-scan.md"],
      ["inception/requirements-analysis/requirements-analysis-questions.md", "design/requirements-analysis/requirements-analysis-questions.md"],
      ["construction/build-and-test/test-results.md", "test/build-and-test/test-results.md"],
      ["construction/ci-pipeline/ci-config.md", "deploy/ci-pipeline/ci-config.md"],
      ["operation/performance-validation/report.md", "test/performance-validation/report.md"],
      ["operation/deployment-pipeline/rollback-runbook.md", "deploy/deployment-pipeline/rollback-runbook.md"],
      ["operation/incident-response/runbooks.md", "operate/incident-response/runbooks.md"],
    ];
    for (const [five, seven] of cases) {
      expect(sevenPhaseRecordPath(`${RECORD}/${five}`)).toBe(`${RECORD}/${seven}`);
      expect(sevenPhaseRecordPath(five)).toBe(seven);
    }
  });

  test("a Unit's folder splits into design/<unit>/ and build/<unit>/, by its stage", () => {
    expect(sevenPhaseRecordPath(`${RECORD}/construction/alpha/code-generation/code-generation-questions.md`))
      .toBe(`${RECORD}/build/alpha/code-generation/code-generation-questions.md`);
    expect(sevenPhaseRecordPath(`${RECORD}/construction/alpha/functional-design/functional-spec.md`))
      .toBe(`${RECORD}/design/alpha/functional-design/functional-spec.md`);
    expect(sevenPhaseRecordPath("construction/beta/nfr-design/")).toBe("design/beta/nfr-design/");
    // A Unit stage kept at stage level (no Units Generation) is a stage folder.
    expect(sevenPhaseRecordPath("construction/code-generation/code-generation-plan.md")).toBe("build/code-generation/code-generation-plan.md");
    expect(sevenPhaseRecordPath("construction/infrastructure-design/x.md")).toBe("design/infrastructure-design/x.md");
  });

  test("backslashes are read as separators, and the path keeps its own", () => {
    const windows = `C:\\work\\proj\\${RECORD.replaceAll("/", "\\")}\\construction\\alpha\\code-generation\\code-generation-questions.md`;
    expect(sevenPhaseRecordPath(windows))
      .toBe(`C:\\work\\proj\\${RECORD.replaceAll("/", "\\")}\\build\\alpha\\code-generation\\code-generation-questions.md`);
    expect(sevenPhaseRecordPath("inception\\units-generation\\unit-of-work.md")).toBe("design\\units-generation\\unit-of-work.md");
    expect(sameRecordPath("inception\\units-generation\\unit-of-work.md", "design\\units-generation\\unit-of-work.md")).toBe(true);
  });

  test("an absolute path translates only its record folder", () => {
    expect(sevenPhaseRecordPath(`/home/u/proj/${RECORD}/inception/user-stories/stories.md`))
      .toBe(`/home/u/proj/${RECORD}/design/user-stories/stories.md`);
  });

  test("a plugin stage moves only when its caller names its old and current folder", () => {
    const plugin = (slug: string) => slug === "test-pro-integration" ? { old: "construction", current: "test" } : null;
    expect(sevenPhaseRecordPath("construction/test-pro-integration/report.md", plugin)).toBe("test/test-pro-integration/report.md");
    expect(sevenPhaseRecordPath("operation/test-pro-integration/report.md", plugin)).toBe("operation/test-pro-integration/report.md");
    expect(sevenPhaseRecordPath("construction/test-pro-integration/report.md")).toBe("construction/test-pro-integration/report.md");
  });

  test("a path that only looks like a five-phase one is left as it is", () => {
    for (const path of [
      "/home/u/construction/app",
      "/home/u/construction/app/src/index.ts",
      "construction/alpha/notes.md",
      "inception/feasibility/feasibility-assessment.md",
      "ideation/requirements-analysis/requirements.md",
      `${RECORD}/design/requirements-analysis/requirements.md`,
      `${RECORD}/build/alpha/code-generation/code-generation-plan.md`,
      "construction",
      "",
    ]) {
      expect(sevenPhaseRecordPath(path)).toBe(path);
    }
  });

  test("a project folder that happens to hold a five-phase name keeps it: only the record's own pair moves", () => {
    expect(sevenPhaseRecordPath(`/home/u/construction/code-generation/${RECORD}/inception/requirements-analysis/requirements.md`))
      .toBe(`/home/u/construction/code-generation/${RECORD}/design/requirements-analysis/requirements.md`);
  });
});

describe("the recorded side is translated, never the current side", () => {
  const recorded = `${RECORD}/construction/alpha/code-generation/code-generation-questions.md`;
  const current = `${RECORD}/build/alpha/code-generation/code-generation-questions.md`;

  test("a five-phase recorded path names the moved file", () => {
    expect(sameRecordPath(recorded, current)).toBe(true);
    expect(sameRecordPath(current, current)).toBe(true);
  });

  test("a current path spelled the five-phase way is not read as the moved one", () => {
    expect(sameRecordPath(current, recorded)).toBe(false);
  });

  test("another file, another Unit or another stage is still another file", () => {
    expect(sameRecordPath(`${RECORD}/construction/beta/code-generation/code-generation-questions.md`, current)).toBe(false);
    expect(sameRecordPath(`${RECORD}/construction/alpha/code-generation/code-generation-plan.md`, current)).toBe(false);
    expect(sameRecordPath(`${RECORD}/construction/alpha/functional-design/code-generation-questions.md`, current)).toBe(false);
    expect(sameRecordPath(`aidlc/spaces/default/intents/other/construction/alpha/code-generation/code-generation-questions.md`, current))
      .toBe(false);
  });
});

describe("a seven-phase review manifest entry in the form a five-phase release hashed it", () => {
  test("stage-level, per-Unit, the no-Units placeholder and a Unit stage kept at stage level", () => {
    const cases: Array<[string, string]> = [
      ["design/requirements-analysis/requirements.md", "inception/requirements-analysis/requirements.md"],
      ["discover/feasibility/feasibility-assessment.md", "ideation/feasibility/feasibility-assessment.md"],
      ["design/alpha/functional-design/functional-spec.md", "construction/alpha/functional-design/functional-spec.md"],
      ["build/alpha/code-generation/code-generation-plan.md", "construction/alpha/code-generation/code-generation-plan.md"],
      ["design/*/functional-design/functional-spec.md", "construction/*/functional-design/functional-spec.md"],
      ["build/code-generation/code-generation-plan.md", "construction/code-generation/code-generation-plan.md"],
      ["test/performance-validation/report.md", "operation/performance-validation/report.md"],
      ["deploy/ci-pipeline/ci-config.md", "construction/ci-pipeline/ci-config.md"],
    ];
    for (const [seven, five] of cases) {
      expect(fivePhaseLogicalPath(seven)).toBe(five);
      // And back: the step's own translation reads it as the current entry.
      expect(sevenPhaseRecordPath(five)).toBe(seven);
    }
  });

  test("an entry no five-phase release kept there has no five-phase form", () => {
    for (const path of [
      "codekb/app/architecture.md",
      "secure/code-review/code-review.md",
      "design/feasibility/feasibility-assessment.md",
      "operate/performance-validation/report.md",
      "design/alpha/code-generation/code-generation-plan.md",
      "requirements.md",
      "design/requirements.md",
    ]) {
      expect(fivePhaseLogicalPath(path)).toBeNull();
    }
  });
});

describe("the frozen tables", () => {
  test("every stage 2.11.4 shipped has a five-phase folder and the seven-phase folder this release keeps it in", () => {
    expect(Object.keys(SEVEN_PHASE_STAGE_FOLDER).sort()).toEqual(Object.keys(FIVE_PHASE_STAGE_FOLDER).sort());
    const graph = loadStageGraphAll();
    for (const [slug, folder] of Object.entries(SEVEN_PHASE_STAGE_FOLDER)) {
      expect(graph.find((stage) => stage.slug === slug)?.phase, slug).toBe(folder);
    }
  });
});

describe("the five-phase forms of a review fingerprint read here", () => {
  test("are found by the current fingerprint, and nothing else is", () => {
    const current = `sha256:${"c".repeat(64)}`;
    rememberFivePhaseFingerprint(current, { fingerprint: `sha256:${"5".repeat(64)}`, raw: `sha256:${"r".repeat(64)}` });
    expect(fivePhaseFingerprintForm(current)).toBe(`sha256:${"5".repeat(64)}`);
    expect(fivePhaseFingerprintForm(current, true)).toBe(`sha256:${"r".repeat(64)}`);
    expect(fivePhaseFingerprintForm(`sha256:${"d".repeat(64)}`)).toBeNull();
  });
});
