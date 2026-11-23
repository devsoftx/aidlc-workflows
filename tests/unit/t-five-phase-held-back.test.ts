// covers: function:heldBackLine
//
// The one line the person hears when the file system refuses a folder move
// the bring-up needs, chosen by why it refused and on which platform. On Linux
// and macOS (darwin) an open folder never stops a move, so a refusal there is a
// folder this user cannot change, and the line says so with the step that
// frees it; EBUSY is a folder in use (a mount point) on every platform. On
// Windows a folder held open and one the user may not change are refused alike
// (EPERM, EACCES), so the line names both, with a step for each. Every form
// reads as plain English for one folder and for several.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { heldBackLine } from "../../dist/claude/.claude/tools/aidlc-state-upgrade.ts";

const made: string[] = [];
afterEach(() => {
  while (made.length) rmSync(made.pop() as string, { recursive: true, force: true });
});

const ONE = [{ from: "inception/requirements-analysis", to: "design/requirements-analysis" }];
const TWO = [{ from: "inception/practices-discovery", to: "design/practices-discovery" }, ...ONE];

// A project with its record folder holding the moves' sources, every folder writable.
function project(): { projectDir: string; recordDir: string } {
  const projectDir = mkdtempSync(join(tmpdir(), "held-back-"));
  made.push(projectDir);
  const recordDir = join(projectDir, "aidlc", "spaces", "default", "intents", "work");
  for (const { from } of TWO) mkdirSync(join(recordDir, ...from.split("/")), { recursive: true });
  return { projectDir, recordDir };
}

function line(platform: NodeJS.Platform, code: string, moves = ONE): string {
  const { projectDir, recordDir } = project();
  return heldBackLine(projectDir, recordDir, moves.map((move) => ({ ...move, code })), platform);
}

const AT = "aidlc/spaces/default/intents/work";
const CLOSE = "(a dev server or test watcher still running over the project, a terminal or an editor inside, a file sync or backup app)";
const CARRY_ON = "ask me to carry on, and AI-DLC finishes moving your work and picks up where you were.";

describe("on Linux and macOS a refused move is a folder this user cannot change", () => {
  for (const platform of ["linux", "darwin"] as const) {
    for (const code of ["EACCES", "EPERM", "EROFS"]) {
      test(`${platform} ${code}: the folder, why it may be so, and the step that frees it`, () => {
        expect(line(platform, code)).toBe(
          `AI-DLC cannot change \`${AT}/inception/requirements-analysis\` (another user or a container may own it, ` +
            "or it may be read-only), so it could not move your work to where this release keeps it. Your work is as " +
            `it was. Give your user write access to it, then ${CARRY_ON}`,
        );
      });
    }
  }

  test("two folders: named together, with plural words", () => {
    expect(line("linux", "EACCES", TWO)).toBe(
      `AI-DLC cannot change \`${AT}/inception/practices-discovery\` and \`${AT}/inception/requirements-analysis\` ` +
        "(another user or a container may own them, or they may be read-only), so it could not move your work to " +
        `where this release keeps it. Your work is as it was. Give your user write access to them, then ${CARRY_ON}`,
    );
  });
});

describe("a folder in use (EBUSY) is one to close, on every platform", () => {
  for (const platform of ["linux", "darwin", "win32"] as const) {
    test(`${platform}: one folder`, () => {
      expect(line(platform, "EBUSY")).toBe(
        `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
          "where this release keeps it: a program on this computer has that folder open. Your work is as it was. " +
          `Close what has it open ${CLOSE}, then ${CARRY_ON}`,
      );
    });
  }

  test("two folders: 'those folders' and 'them', never 'or them cannot'", () => {
    const said = line("win32", "EBUSY", TWO);
    expect(said).toBe(
      `AI-DLC could not move \`${AT}/inception/practices-discovery\` and \`${AT}/inception/requirements-analysis\` ` +
        "to where this release keeps them: a program on this computer has those folders open. Your work is as it " +
        `was. Close what has them open ${CLOSE}, then ${CARRY_ON}`,
    );
    expect(said).not.toMatch(/\bor them\b/);
  });
});

describe("on Windows a folder held open and one the user may not change are refused alike", () => {
  for (const code of ["EPERM", "EACCES", "UNKNOWN"]) {
    test(`${code}: both are named, with a step for each`, () => {
      expect(line("win32", code)).toBe(
        `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
          "where this release keeps it: a program on this computer has that folder open, or your user cannot change " +
          `it. Your work is as it was. Close what has it open ${CLOSE}; if nothing has it open, give your user write ` +
          `access to it. Then ${CARRY_ON}`,
      );
    });
  }

  test("two folders: plural throughout", () => {
    expect(line("win32", "EPERM", TWO)).toBe(
      `AI-DLC could not move \`${AT}/inception/practices-discovery\` and \`${AT}/inception/requirements-analysis\` ` +
        "to where this release keeps them: a program on this computer has those folders open, or your user cannot " +
        `change them. Your work is as it was. Close what has them open ${CLOSE}; if nothing has them open, give ` +
        `your user write access to them. Then ${CARRY_ON}`,
    );
  });

  test("a read-only drive (EROFS) is one this user cannot change", () => {
    expect(line("win32", "EROFS")).toStartWith(`AI-DLC cannot change \`${AT}/inception/requirements-analysis\` (`);
  });

  test("refusals of both kinds name both", () => {
    const { projectDir, recordDir } = project();
    const said = heldBackLine(projectDir, recordDir, [{ ...TWO[0], code: "EBUSY" }, { ...TWO[1], code: "EROFS" }], "win32");
    expect(said).toContain("has those folders open, or your user cannot change them.");
  });
});
