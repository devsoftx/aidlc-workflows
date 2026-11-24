// covers: function:heldBackLine, function:unwritableFolderFor
//
// The one line the person hears when the file system refuses a folder move
// the bring-up needs, chosen by why it refused and on which platform, and the
// access check that says a folder this user cannot change. A folder this user
// cannot change is said alone only when the access check finds it (Linux and
// macOS) or the drive is read-only (EROFS): a Windows drive under WSL and a
// network share refuse a folder a Windows program holds open as EACCES or
// EPERM on Linux too, so any other refusal names both, with a step for each.
// On Windows a folder held open is EBUSY; elsewhere EBUSY is also a folder
// something is mounted on, and EXDEV one on another mount, whose step is to
// move what it holds by hand; a full drive is freed by making space. Linux
// lets a folder this user cannot write be renamed in place, so a rename that
// keeps its parent asks no write access of the folder itself. Every form
// reads as plain English for one folder and for several.
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unwritableFolderFor } from "../../dist/claude/.claude/tools/aidlc-seven-phase-upgrade.ts";
import { heldBackLine } from "../../dist/claude/.claude/tools/aidlc-state-upgrade.ts";

const made: string[] = [];
const unlocks: (() => void)[] = [];
afterEach(() => {
  while (unlocks.length) (unlocks.pop() as () => void)();
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

// Makes `dir` a folder this user cannot change, as one another user or a
// container made is: read-only to its owner, and immutable for root, whom no
// mode bit stops. The lock is lifted after the test, wherever the folder went.
function lockFolder(dir: string): void {
  if (process.getuid?.() !== 0) {
    chmodSync(dir, 0o555);
    unlocks.push(() => {
      if (existsSync(dir)) chmodSync(dir, 0o755);
    });
    return;
  }
  const locked = spawnSync("chattr", ["+i", dir], { encoding: "utf-8" });
  expect(locked.status, `chattr +i: ${locked.stderr}`).toBe(0);
  unlocks.push(() => {
    spawnSync("chattr", ["-i", dir]);
  });
}

const AT = "aidlc/spaces/default/intents/work";
const CLOSE = "(a dev server or test watcher still running over the project, a terminal or an editor inside, a file sync or backup app)";
const CARRY_ON = "ask me to carry on, and AI-DLC finishes moving your work and picks up where you were.";
const CANNOT_CHANGE_ONE =
  `AI-DLC cannot change \`${AT}/inception/requirements-analysis\` (another user or a container may own it, ` +
  "or it may be read-only), so it could not move your work to where this release keeps it. Your work is as " +
  `it was. Give your user write access to it, then ${CARRY_ON}`;
const EITHER_ONE =
  `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
  "where this release keeps it: a program on this computer has that folder open, or your user cannot change " +
  `it. Your work is as it was. Close what has it open ${CLOSE}; if nothing has it open, give your user write ` +
  `access to it. Then ${CARRY_ON}`;

describe("on Linux and macOS a folder this user cannot change is said alone only when that is so", () => {
  for (const platform of ["linux", "darwin"] as const) {
    test(`${platform} EROFS: a read-only drive is a folder this user cannot change, with the step that frees it`, () => {
      expect(line(platform, "EROFS")).toBe(CANNOT_CHANGE_ONE);
    });

    // A Windows program holding the folder open under WSL (/mnt/c), or on a
    // network share, is refused this way while the access check finds every
    // folder writable: the line names closing it, the step that works then.
    for (const code of ["EACCES", "EPERM", "EIO"]) {
      test(`${platform} ${code} with every folder writable: both reasons, with a step for each`, () => {
        expect(line(platform, code)).toBe(EITHER_ONE);
      });
    }
  }

  test.skipIf(process.platform === "win32")("EACCES on a folder this user really cannot change names that folder alone", () => {
    const { projectDir, recordDir } = project();
    lockFolder(join(recordDir, "inception", "requirements-analysis"));
    const said = heldBackLine(projectDir, recordDir, [{ ...ONE[0], code: "EACCES" }]);
    expect(said).toBe(CANNOT_CHANGE_ONE);
  });

  test("two folders on a read-only drive: named together, with plural words", () => {
    expect(line("linux", "EROFS", TWO)).toBe(
      `AI-DLC cannot change \`${AT}/inception/practices-discovery\` and \`${AT}/inception/requirements-analysis\` ` +
        "(another user or a container may own them, or they may be read-only), so it could not move your work to " +
        `where this release keeps it. Your work is as it was. Give your user write access to them, then ${CARRY_ON}`,
    );
  });

  test("two folders refused with EACCES while writable: both reasons, plural throughout", () => {
    expect(line("linux", "EACCES", TWO)).toBe(
      `AI-DLC could not move \`${AT}/inception/practices-discovery\` and \`${AT}/inception/requirements-analysis\` ` +
        "to where this release keeps them: a program on this computer has those folders open, or your user cannot " +
        `change them. Your work is as it was. Close what has them open ${CLOSE}; if nothing has them open, give ` +
        `your user write access to them. Then ${CARRY_ON}`,
    );
  });
});

describe("a folder in use (EBUSY)", () => {
  test("win32: one a program holds open, which is closed", () => {
    expect(line("win32", "EBUSY")).toBe(
      `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
        "where this release keeps it: a program on this computer has that folder open. Your work is as it was. " +
        `Close what has it open ${CLOSE}, then ${CARRY_ON}`,
    );
  });

  // A Linux or macOS drive of its own refuses no open folder: EBUSY is a
  // network share's open folder, or a folder something is mounted on, which
  // closing a program never frees and unmounting would leave its work behind.
  for (const platform of ["linux", "darwin"] as const) {
    test(`${platform}: held open or mounted, with a step for each`, () => {
      expect(line(platform, "EBUSY")).toBe(
        `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
          "where this release keeps it: a program on this computer has that folder open, or something is mounted " +
          `there (a container's volume or a network drive). Your work is as it was. Close what has it open ${CLOSE}; ` +
          `if nothing has it open, move what is in it to \`${AT}/design/requirements-analysis\` yourself. Then ${CARRY_ON}`,
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

  test("two folders off Windows: each named with where it goes, for the move by hand", () => {
    const said = line("linux", "EBUSY", TWO);
    expect(said).toBe(
      `AI-DLC could not move \`${AT}/inception/practices-discovery\` and \`${AT}/inception/requirements-analysis\` ` +
        "to where this release keeps them: a program on this computer has those folders open, or something is " +
        `mounted there (a container's volume or a network drive). Your work is as it was. Close what has them open ` +
        `${CLOSE}; if nothing has them open, move what is in each to where this release keeps it yourself ` +
        `(\`${AT}/inception/practices-discovery\` to \`${AT}/design/practices-discovery\` and ` +
        `\`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`). Then ${CARRY_ON}`,
    );
    expect(said).not.toMatch(/\bor them\b|unmount/);
  });
});

describe("a mount in the way and a full drive, on every platform", () => {
  for (const platform of ["linux", "darwin", "win32"] as const) {
    test(`${platform} EXDEV: the folder is on another mount, and what it holds is moved by hand`, () => {
      expect(line(platform, "EXDEV")).toBe(
        `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
          "where this release keeps it: something is mounted there (a container's volume or a network drive). Your " +
          `work is as it was. Move what is in it to \`${AT}/design/requirements-analysis\` yourself, then ${CARRY_ON}`,
      );
    });

    for (const code of ["ENOSPC", "EDQUOT"]) {
      test(`${platform} ${code}: the drive is full, and space frees it`, () => {
        expect(line(platform, code)).toBe(
          `AI-DLC could not move \`${AT}/inception/requirements-analysis\` to \`${AT}/design/requirements-analysis\`, ` +
            `where this release keeps it: the drive is full. Your work is as it was. Free some space on the drive, then ${CARRY_ON}`,
        );
      });
    }
  }
});

describe("on Windows a folder held open and one the user may not change are refused alike", () => {
  for (const code of ["EPERM", "EACCES", "UNKNOWN"]) {
    test(`${code}: both are named, with a step for each`, () => {
      expect(line("win32", code)).toBe(EITHER_ONE);
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

// Linux updates a folder's ".." entry only when it gets a new parent, so a
// folder this user cannot write renames in place (a sensor folder's rename);
// as root no mode bit stops anything, and an immutable folder renames nowhere.
describe.skipIf(process.platform !== "linux" || process.getuid?.() === 0)("the access check asks Linux only what the rename needs", () => {
  function sensors(): { recordDir: string; folder: string } {
    const { recordDir } = project();
    const folder = join(recordDir, ".aidlc-sensors", "application-design");
    mkdirSync(folder, { recursive: true });
    lockFolder(folder);
    return { recordDir, folder };
  }
  const RENAME = { from: ".aidlc-sensors/application-design", to: ".aidlc-sensors/domain-design" };

  test("a rename that keeps its parent needs no write access on the folder itself, and Linux makes it", () => {
    const { recordDir, folder } = sensors();
    expect(unwritableFolderFor(recordDir, RENAME, "linux")).toBeNull();
    renameSync(folder, join(recordDir, ".aidlc-sensors", "domain-design"));
    unlocks.push(() => chmodSync(join(recordDir, ".aidlc-sensors", "domain-design"), 0o755));
  });

  test("a new parent, and macOS on any rename, need it", () => {
    const { recordDir } = sensors();
    const away = { from: RENAME.from, to: "design/domain-design" };
    expect(unwritableFolderFor(recordDir, away, "linux")).toBe(RENAME.from);
    expect(unwritableFolderFor(recordDir, RENAME, "darwin")).toBe(RENAME.from);
  });
});

describe.skipIf(process.platform !== "linux" || process.getuid?.() !== 0)("an immutable folder renames nowhere on Linux", () => {
  test("the access check names it even for a rename that keeps its parent, as the rename itself refuses", () => {
    const { recordDir } = project();
    const folder = join(recordDir, ".aidlc-sensors", "application-design");
    mkdirSync(folder, { recursive: true });
    lockFolder(folder);
    const RENAME = { from: ".aidlc-sensors/application-design", to: ".aidlc-sensors/domain-design" };
    expect(unwritableFolderFor(recordDir, RENAME, "linux")).toBe(RENAME.from);
    expect(() => renameSync(folder, join(recordDir, ".aidlc-sensors", "domain-design"))).toThrow();
  });
});
