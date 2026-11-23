// covers: function:fivePhaseFolderPlan, function:moveFivePhaseFolders, function:fivePhaseFolderFindings
//
// The record-folder half of the 8 to 10 step, on a record folder laid out as
// 2.11.4 lays one out. A Unit is a Unit whatever its name, a stage's included
// (2.11.4 let a Unit take any name), and its stage folders go where every
// reader of recorded evidence reads them (sevenPhaseRecordPath). The files an
// OS drops in a folder the person browsed (.DS_Store, Thumbs.db, desktop.ini)
// are no one's work: never named, and never what keeps an old folder. A move
// the file system refuses is not a folder already there: the whole move is put
// back, so the next attempt makes it again.
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { sevenPhaseRecordPath } from "../../dist/claude/.claude/tools/aidlc-five-phase-record.ts";
import {
  fivePhaseFolderFindings,
  fivePhaseFolderPlan,
  moveFivePhaseFolders,
} from "../../dist/claude/.claude/tools/aidlc-seven-phase-upgrade.ts";

const made: string[] = [];
const AIDLC_TEST = process.env.AIDLC_TEST;
afterEach(() => {
  while (made.length) rmSync(made.pop() as string, { recursive: true, force: true });
  delete process.env.AIDLC_TEST_FOLDER_MOVE_FAIL;
  if (AIDLC_TEST === undefined) delete process.env.AIDLC_TEST;
  else process.env.AIDLC_TEST = AIDLC_TEST;
});

// A record folder holding `files` (record-relative path to text).
function record(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "five-phase-move-"));
  made.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function files(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else out[relative(dir, path).split("\\").join("/")] = readFileSync(path, "utf-8");
    }
  };
  walk(dir);
  return out;
}

function folders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

describe("a Unit named like a stage is a Unit", () => {
  // 2.11.4 Units named like a stage it did not ship (code-review,
  // security-review), like a stage of another phase (incident-response,
  // feasibility) and like none (store), beside a stage-level Code Generation.
  const layout = {
    "construction/code-review/functional-design/functional-spec.md": "code-review spec\n",
    "construction/code-review/code-generation/code-generation-plan.md": "code-review plan\n",
    "construction/security-review/nfr-requirements/security-requirements.md": "security-review nfr\n",
    "construction/incident-response/functional-design/functional-spec.md": "incident-response spec\n",
    "construction/incident-response/infrastructure-design/infrastructure-specification.md": "incident-response infra\n",
    "construction/feasibility/nfr-design/logical-components.md": "feasibility nfr design\n",
    "construction/store/functional-design/functional-spec.md": "store spec\n",
    "construction/code-generation/code-generation-plan.md": "stage-level plan\n",
    "operation/incident-response/runbooks.md": "the stage's runbooks\n",
  };

  test("each of its stage folders moves to <phase>/<unit>/<stage>, where the readers look for it", () => {
    const dir = record(layout);
    const plan = fivePhaseFolderPlan(dir);
    expect(plan.unplaced).toEqual([]);
    expect(plan.moves).toContainEqual({ from: "construction/code-review/functional-design", to: "design/code-review/functional-design" });
    expect(plan.moves).toContainEqual({ from: "construction/code-review/code-generation", to: "build/code-review/code-generation" });
    expect(plan.moves).toContainEqual({ from: "construction/security-review/nfr-requirements", to: "design/security-review/nfr-requirements" });
    expect(plan.moves).toContainEqual({ from: "construction/incident-response/functional-design", to: "design/incident-response/functional-design" });
    expect(plan.moves).toContainEqual({ from: "construction/feasibility/nfr-design", to: "design/feasibility/nfr-design" });
    expect(plan.moves).toContainEqual({ from: "construction/code-generation", to: "build/code-generation" });
    expect(plan.moves).toContainEqual({ from: "operation/incident-response", to: "operate/incident-response" });
    expect(plan.moves.some((move) => move.to.startsWith("secure/"))).toBe(false);
    const result = moveFivePhaseFolders(dir);
    expect(result.failed).toEqual([]);
    expect(result.left).toEqual([]);
    // Every file is where the one table reads its recorded path, and nothing else moved.
    expect(files(dir)).toEqual(Object.fromEntries(Object.entries(layout).map(([path, text]) => [sevenPhaseRecordPath(path), text])));
    expect(folders(dir)).toEqual(["build", "design", "operate"]);
    expect(fivePhaseFolderFindings(dir, "rec")).toEqual([]);
  });
});

describe("what an OS drops in a folder is no one's work", () => {
  const layout = {
    "ideation/intent-capture/intent-statement.md": "intent\n",
    "ideation/intent-capture/.DS_Store": "finder\n",
    "ideation/.DS_Store": "finder\n",
    "inception/requirements-analysis/requirements.md": "requirements\n",
    "inception/Thumbs.db": "explorer\n",
    "inception/desktop.ini": "explorer\n",
    "construction/.DS_Store": "finder\n",
    "construction/store/.DS_Store": "finder\n",
    "construction/store/functional-design/functional-spec.md": "store spec\n",
    // A Unit folder that holds only what Finder wrote, beside one that holds work.
    "construction/cli/.DS_Store": "finder\n",
    "operation/notes/.DS_Store": "finder\n",
  };

  test("it is never named as left behind, and never keeps an old folder", () => {
    const dir = record(layout);
    const plan = fivePhaseFolderPlan(dir);
    expect(plan.unplaced).toEqual([]);
    // Doctor names only the stage folders still to move.
    expect(fivePhaseFolderFindings(dir, "rec").map((finding) => finding.label.split(": ")[1])).toEqual([
      "rec/ideation/intent-capture",
      "rec/inception/requirements-analysis",
      "rec/construction/store/functional-design",
    ]);
    const result = moveFivePhaseFolders(dir);
    expect(result).toMatchObject({ left: [], failed: [] });
    expect(folders(dir)).toEqual(["design", "discover"]);
    expect(fivePhaseFolderFindings(dir, "rec")).toEqual([]);
    // A stage folder's own moves with it, as every file in it does.
    expect(files(dir)).toEqual({
      "discover/intent-capture/intent-statement.md": "intent\n",
      "discover/intent-capture/.DS_Store": "finder\n",
      "design/requirements-analysis/requirements.md": "requirements\n",
      "design/store/functional-design/functional-spec.md": "store spec\n",
    });
  });

  test("the person's own file beside it still keeps its folder and is named", () => {
    const dir = record({ ...layout, "inception/notes.md": "mine\n" });
    const result = moveFivePhaseFolders(dir);
    expect(result.left).toEqual(["inception/notes.md"]);
    expect(readFileSync(join(dir, "inception", "notes.md"), "utf-8")).toBe("mine\n");
    expect(fivePhaseFolderFindings(dir, "rec").map((finding) => finding.label)).toEqual([
      "Left where an earlier AI-DLC kept it, and not read there now: rec/inception/notes.md",
    ]);
  });
});

describe("a move the file system refuses holds the whole move back", () => {
  const layout = {
    "ideation/intent-capture/intent-statement.md": "intent\n",
    "inception/practices-discovery/discovered-rules.md": "rules\n",
    "inception/requirements-analysis/requirements.md": "requirements\n",
    "construction/store/functional-design/functional-spec.md": "store spec\n",
  };

  test("every move is put back and the refused one is named; the next attempt makes them all", () => {
    const dir = record(layout);
    process.env.AIDLC_TEST = "1";
    process.env.AIDLC_TEST_FOLDER_MOVE_FAIL = "inception/requirements-analysis";
    const held = moveFivePhaseFolders(dir);
    expect(held.failed).toEqual([{ from: "inception/requirements-analysis", to: "design/requirements-analysis" }]);
    expect(held.moved).toEqual([]);
    // The record is as 2.11.4 left it: no file moved, and no new folder made.
    expect(files(dir)).toEqual(layout);
    expect(folders(dir)).toEqual(["construction", "ideation", "inception"]);
    delete process.env.AIDLC_TEST_FOLDER_MOVE_FAIL;
    const again = moveFivePhaseFolders(dir);
    expect(again.failed).toEqual([]);
    expect(again.moved).toEqual([
      "ideation/intent-capture to discover/intent-capture",
      "inception/practices-discovery to design/practices-discovery",
      "inception/requirements-analysis to design/requirements-analysis",
      "construction/store/functional-design to design/store/functional-design",
    ]);
    expect(files(dir)).toEqual(Object.fromEntries(Object.entries(layout).map(([path, text]) => [sevenPhaseRecordPath(path), text])));
  });

  test("a file already at the target is kept as a conflict, never a refusal", () => {
    const dir = record({ ...layout, "design/requirements-analysis/requirements.md": "already here\n" });
    const result = moveFivePhaseFolders(dir);
    expect(result.failed).toEqual([]);
    expect(result.left).toEqual(["inception/requirements-analysis/requirements.md"]);
    expect(readFileSync(join(dir, "design", "requirements-analysis", "requirements.md"), "utf-8")).toBe("already here\n");
    expect(existsSync(join(dir, "design", "practices-discovery", "discovered-rules.md"))).toBe(true);
  });
});
