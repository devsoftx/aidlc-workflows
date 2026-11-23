// covers: function:sevenPhaseRecordPath, function:sameRecordPath, function:fivePhaseLogicalPath, function:fivePhaseLogicalSpellings,
// function:fivePhaseRecordPath, function:fivePhaseRecordSpellings, function:registerFivePhaseStageGraph, function:rememberFivePhaseFingerprint,
// function:fivePhaseFingerprintForm
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
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  FIVE_PHASE_STAGE_FOLDER,
  fivePhaseFingerprintForm,
  fivePhaseLogicalPath,
  fivePhaseLogicalSpellings,
  fivePhaseRecordPath,
  fivePhaseRecordSpellings,
  rememberFivePhaseFingerprint,
  sameRecordPath,
  SEVEN_PHASE_STAGE_FOLDER,
  sevenPhaseRecordPath,
} from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import { _resetStageGraphForTests, loadStageGraphAll } from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";

const RECORD = "aidlc/spaces/default/intents/fixture-8000000000000001";

// The stage graph with test-pro's stages at the phases its stage files name
// now (2.11.4 shipped them under construction/ and operation/), and a team
// plugin's stage that runs once per Unit, while `run` reads it.
function withPluginGraph<T>(run: () => T): T {
  const stagesDir = join(REPO_ROOT, "plugins", "test-pro", "stages");
  const plugin = readdirSync(stagesDir).flatMap((phase) =>
    readdirSync(join(stagesDir, phase)).map((file) => ({ slug: basename(file, ".md"), phase, plugin: "test-pro" })));
  expect(plugin.map(({ slug, phase }) => `${phase}/${slug}`).sort())
    .toEqual(["operate/test-pro-full-suite", "test/test-pro-integration"]);
  const perUnit = { slug: "team-unit-check", phase: "build", plugin: "team", for_each: "unit-of-work" };
  const dir = mkdtempSync(join(tmpdir(), "aidlc-plugin-graph-"));
  const graph = join(dir, "stage-graph.json");
  writeFileSync(graph, JSON.stringify([...loadStageGraphAll(), ...plugin, perUnit]));
  const prior = process.env.AIDLC_STAGE_GRAPH;
  process.env.AIDLC_STAGE_GRAPH = graph;
  _resetStageGraphForTests();
  try {
    return run();
  } finally {
    if (prior === undefined) delete process.env.AIDLC_STAGE_GRAPH;
    else process.env.AIDLC_STAGE_GRAPH = prior;
    _resetStageGraphForTests();
    rmSync(dir, { recursive: true, force: true });
  }
}

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

  // 2.11.4 let a Unit take any name, a five-phase folder's or a stage's
  // included, and the 8 to 10 step moves a folder under construction/ that
  // holds a per-Unit stage's folder as a Unit, whatever its name.
  test("a Unit reads as a Unit whatever it is called, both ways, and a row written since stays as it is", () => {
    const cases: Array<[string, string]> = [
      ["construction/construction/code-generation/code-generation-plan.md", "build/construction/code-generation/code-generation-plan.md"],
      ["construction/construction/functional-design/functional-spec.md", "design/construction/functional-design/functional-spec.md"],
      ["construction/inception/nfr-design/security-design.md", "design/inception/nfr-design/security-design.md"],
      ["construction/operation/code-generation/code-summary.md", "build/operation/code-generation/code-summary.md"],
      ["construction/code-generation/functional-design/functional-spec.md", "design/code-generation/functional-design/functional-spec.md"],
      ["construction/code-generation/code-generation/code-generation-plan.md", "build/code-generation/code-generation/code-generation-plan.md"],
      ["construction/functional-design/code-generation/code-summary.md", "build/functional-design/code-generation/code-summary.md"],
      ["construction/requirements-analysis/nfr-requirements/tech-stack-decisions.md", "design/requirements-analysis/nfr-requirements/tech-stack-decisions.md"],
    ];
    for (const [five, seven] of cases) {
      expect(sevenPhaseRecordPath(`${RECORD}/${five}`), five).toBe(`${RECORD}/${seven}`);
      expect(sevenPhaseRecordPath(five), five).toBe(seven);
      expect(sevenPhaseRecordPath(`${RECORD}/${seven}`), seven).toBe(`${RECORD}/${seven}`);
      expect(sameRecordPath(`${RECORD}/${five}`, `${RECORD}/${seven}`), five).toBe(true);
      expect(fivePhaseLogicalPath(seven), seven).toBe(five);
      expect(fivePhaseRecordPath(`${RECORD}/${seven}`), seven).toBe(`${RECORD}/${five}`);
    }
    expect(sevenPhaseRecordPath(`C:\\p\\${RECORD.replaceAll("/", "\\")}\\design\\construction\\functional-design\\x.md`))
      .toBe(`C:\\p\\${RECORD.replaceAll("/", "\\")}\\design\\construction\\functional-design\\x.md`);
    // Another Unit's folder is still another file.
    expect(sameRecordPath(`${RECORD}/construction/construction/code-generation/code-summary.md`,
      `${RECORD}/build/build/code-generation/code-summary.md`)).toBe(false);
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
    // A path written since, under such a folder, is already in the record's layout.
    for (const path of [
      `/home/u/construction/alpha/code-generation/${RECORD}/design/requirements-analysis/requirements.md`,
      `/home/u/construction/alpha/code-generation/${RECORD}/build/alpha/code-generation/code-summary.md`,
      `/home/u/inception/requirements-analysis/${RECORD}/discover/intent-capture/intent-statement.md`,
    ]) expect(sevenPhaseRecordPath(path), path).toBe(path);
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

describe("a project-relative seven-phase path in the spelling a five-phase release recorded", () => {
  test("stage-level and per-Unit paths go back to their five-phase folder, and back again", () => {
    const cases: Array<[string, string]> = [
      [`${RECORD}/design/requirements-analysis/requirements.md`, `${RECORD}/inception/requirements-analysis/requirements.md`],
      [`${RECORD}/discover/intent-capture/intent-statement.md`, `${RECORD}/ideation/intent-capture/intent-statement.md`],
      [`${RECORD}/design/store/functional-design/functional-spec.md`, `${RECORD}/construction/store/functional-design/functional-spec.md`],
      [`${RECORD}/build/store/code-generation/code-generation-plan.md`, `${RECORD}/construction/store/code-generation/code-generation-plan.md`],
      [`${RECORD}/test/performance-validation/report.md`, `${RECORD}/operation/performance-validation/report.md`],
    ];
    for (const [seven, five] of cases) {
      expect(fivePhaseRecordPath(seven)).toBe(five);
      expect(sevenPhaseRecordPath(five)).toBe(seven);
    }
  });

  test("a Unit named like a phase still reads as a Unit", () => {
    expect(fivePhaseRecordPath(`${RECORD}/design/design/functional-design/spec.md`))
      .toBe(`${RECORD}/construction/design/functional-design/spec.md`);
  });

  test("a path that names no stage a five-phase release kept has no five-phase spelling", () => {
    for (const path of [
      `${RECORD}/secure/code-review/code-review-report.md`,
      `${RECORD}/design/requirements-analysis`,
      `${RECORD}/test/functional-design/spec.md`,
      "aidlc/spaces/default/codekb/app/architecture.md",
      "src/design/widget.ts",
    ]) expect(fivePhaseRecordPath(path), path).toBeNull();
  });
});

// A stage the frozen tables do not know (a plugin's) is moved by the 8 to 10
// step from whichever five-phase folder holds it to its phase in the stage
// graph; its recorded paths read there too. 2.11.4 recorded no folder for it,
// so its five-phase spelling is one per five-phase folder, each over the same
// documents.
describe("a plugin stage reads at its phase in the stage graph", () => {
  test("its recorded paths read where the step moves its folder, from any five-phase folder", () => {
    withPluginGraph(() => {
      const cases: Array<[string, string]> = [
        ["construction/test-pro-integration/test-pro-integration-test-results.md", "test/test-pro-integration/test-pro-integration-test-results.md"],
        ["operation/test-pro-integration/test-pro-integration-test-plan.md", "test/test-pro-integration/test-pro-integration-test-plan.md"],
        ["operation/test-pro-full-suite/test-pro-full-suite-results.md", "operate/test-pro-full-suite/test-pro-full-suite-results.md"],
        ["construction/alpha/team-unit-check/report.md", "build/alpha/team-unit-check/report.md"],
        ["construction/construction/team-unit-check/report.md", "build/construction/team-unit-check/report.md"],
      ];
      for (const [five, seven] of cases) {
        expect(sevenPhaseRecordPath(`${RECORD}/${five}`), five).toBe(`${RECORD}/${seven}`);
        expect(sevenPhaseRecordPath(`${RECORD}/${seven}`), seven).toBe(`${RECORD}/${seven}`);
        expect(sameRecordPath(`${RECORD}/${five}`, `${RECORD}/${seven}`)).toBe(true);
      }
      // A stage the graph does not know, under a five-phase folder, is not a stage's.
      expect(sevenPhaseRecordPath("construction/not-a-stage/report.md")).toBe("construction/not-a-stage/report.md");
    });
    // With the plugin not in the graph, its folder is not moved, and its paths stay as they are.
    expect(sevenPhaseRecordPath("construction/test-pro-integration/report.md")).toBe("construction/test-pro-integration/report.md");
  });

  test("its five-phase spelling is one per five-phase folder; a per-Unit one has one, and the frozen stages one", () => {
    withPluginGraph(() => {
      const entries = ["test/test-pro-integration/a.md", "test/test-pro-integration/b.md"];
      expect(fivePhaseLogicalPath(entries[0])).toBeNull();
      expect(fivePhaseLogicalPath(entries[0], "construction")).toBe("construction/test-pro-integration/a.md");
      expect(fivePhaseLogicalSpellings(entries)).toEqual(["ideation", "inception", "construction", "operation"]
        .map((folder) => entries.map((entry) => entry.replace(/^test\//, `${folder}/`))));
      expect(fivePhaseRecordSpellings([`${RECORD}/${entries[0]}`, `${RECORD}/design/requirements-analysis/requirements.md`]))
        .toEqual(["ideation", "inception", "construction", "operation"].map((folder) => [
          `${RECORD}/${folder}/test-pro-integration/a.md`, `${RECORD}/inception/requirements-analysis/requirements.md`,
        ]));
      expect(fivePhaseLogicalSpellings(["build/alpha/team-unit-check/report.md"])).toEqual([["construction/alpha/team-unit-check/report.md"]]);
      expect(fivePhaseLogicalSpellings(["design/requirements-analysis/requirements.md", "codekb/app/architecture.md"]))
        .toEqual([["inception/requirements-analysis/requirements.md", null]]);
      expect(fivePhaseLogicalSpellings(["codekb/app/architecture.md"])).toEqual([]);
      // A plugin stage's entry at another phase than its own names no stage it kept.
      expect(fivePhaseLogicalSpellings(["design/test-pro-integration/a.md"])).toEqual([]);
    });
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
