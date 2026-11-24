// A record an earlier State Version wrote, brought up to the current one in
// place the first time the engine reads it, so work started on an older
// AI-DLC carries on after an update with nothing asked and nothing said.
// One owner: the engine's state read (loadStateFileIfPresent in
// aidlc-orchestrate.ts) calls bringStateUpToDate, doctor and status read
// hasStateUpgrade and stateUpgradeRecord, and status (pendingBringUp), the
// status line and the session-start context show broughtUpStateText before the
// step has run, so they never disagree with it.
// A record a newer AI-DLC wrote is never brought down: newerStateStep names
// the release it needs and the person's step, for next, report, doctor and the
// unit commands alike.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { appendAuditEntryUnlocked } from "./aidlc-audit.ts";
import { classifyStateVersion, findStageBySlug, nextInScopeStage } from "./aidlc-lib.ts";
import { isReadOnlyEngineProbe, withAuditLock, writeFileAtomic } from "./aidlc-locks.ts";
import {
  auditBlockField,
  type BringUpAhead,
  getField,
  readAuditShardEvents,
  setField,
  writeStateFile,
} from "./aidlc-record-core.ts";
import { packageManagerForExecutable } from "./aidlc-install-paths.ts";
import { releaseHostLabel } from "./aidlc-release.ts";
import {
  type FolderMove,
  type FolderRefusal,
  type FolderRename,
  fivePhaseFolderPlan,
  fivePhaseReorder,
  moveFivePhaseFolders,
  putFolderMovesBack,
  renameRecordFolder,
  sevenPhaseStateText,
  unwritableFolderFor,
} from "./aidlc-seven-phase-upgrade.ts";
import { aidlcInvocation, compiledExecutable, runtimeHarnessName, typedHarnessName } from "./aidlc-runtime-paths.ts";
import { AIDLC_VERSION } from "./aidlc-version.ts";

export const STATE_UPGRADED_EVENT = "STATE_UPGRADED";

interface StageRename {
  from: string;
  to: string;
  // The names the person read, for the one field that holds a name (Next Action).
  fromName: string;
  toName: string;
  // The phase folder the record kept the stage's files in: the one the release
  // that wrote the record used, not the phase the current graph gives the stage.
  fromPhase: string;
}

interface StateUpgrade {
  to: string;
  renamed: StageRename[];
  // addedStagesPassedOver reads them from this step's audit row, so work that
  // had just passed one goes back to it. A step without `text` writes no row
  // for them: a missing row reads as pending, and the move onto the stage
  // writes it beside its phase's rows.
  added: string[];
  // The step's own rewrite of the state text, after the version line and the renames.
  text?: (content: string, added: readonly string[]) => string;
  // The step's own record-folder moves, after every rename's: what they moved,
  // what they left behind, and what the file system would not let move (the
  // step has put its own moves back then).
  folders?: (recordDir: string) => { moved: string[]; left: string[]; failed: FolderMove[] };
  // The moves `folders` would make on the record as it is, written nowhere:
  // doctor and status find a folder that keeps them from being made, and the
  // count of the stages still to run reads the record's folders through them.
  plan?: (recordDir: string) => FolderMove[];
  // What the step's new stage order does around the cursor, read from the
  // state text the step starts from: the stages it puts behind the cursor that
  // the work still owes (stagesOwedBehindCursor reads them from this step's
  // audit row, as Stages moved behind, so `next` goes back to them), and the
  // ones `text` marks skipped because the work had passed them over.
  reorder?: (content: string) => { movedBehind: string[]; keptPassedOver: string[] };
}

// Keyed by the version a step starts from. 2.1.x to 2.3.0 wrote 7; 8 renamed
// Application Design to Domain Design and added Contract Design. 2.6.1 to
// 2.11.4 wrote 8, five phases; 10 is the seven-phase layout, with the three
// Secure stages added. The 8 step skips 9, which upstream AI-DLC 2.12 writes
// for team work (classifyStateVersion reads it as newer work).
const STATE_UPGRADES: Readonly<Record<string, StateUpgrade>> = {
  "7": {
    to: "8",
    renamed: [
      { from: "application-design", to: "domain-design", fromName: "Application Design", toName: "Domain Design", fromPhase: "inception" },
    ],
    added: ["contract-design"],
  },
  "8": {
    to: "10",
    renamed: [],
    // A missing row would stay missing here: no Secure stage has a row to
    // be placed beside, so the step writes theirs.
    added: ["code-review", "security-review", "conformance-review"],
    text: sevenPhaseStateText,
    folders: moveFivePhaseFolders,
    plan: (recordDir) => fivePhaseFolderPlan(recordDir).moves,
    reorder: fivePhaseReorder,
  },
};

// The fields that hold one stage slug; the person's own words (Project) are never touched.
const STAGE_FIELDS = ["Current Stage", "Next Stage", "In Progress", "Last Completed Stage", "Parked At Stage"];

export function hasStateUpgrade(version: string): boolean {
  return Object.hasOwn(STATE_UPGRADES, version);
}

function upgradedText(content: string, step: StateUpgrade): string {
  let text = content.replace(/^(- \*\*State Version\*\*:)[ \t]*\S+[ \t]*$/m, `$1 ${step.to}`);
  for (const r of step.renamed) {
    text = text.replace(new RegExp(`^(- \\[[ xSR?-]\\] )${r.from}( \\u2014)`, "gm"), `$1${r.to}$2`);
    for (const field of STAGE_FIELDS) {
      if (getField(text, field) === r.from) text = setField(text, field, r.to);
    }
    const action = getField(text, "Next Action");
    if (action?.includes(r.fromName)) text = setField(text, "Next Action", action.replaceAll(r.fromName, r.toName));
    const skipped = getField(text, "Stages to Skip");
    if (skipped?.includes(`(${r.from}`)) text = setField(text, "Stages to Skip", skipped.replaceAll(`(${r.from}`, `(${r.to}`));
  }
  return step.text ? step.text(text, step.added) : text;
}

// Whether an earlier State Version wrote this record, one a step brings up to
// the current one (bringStateUpToDate) the next time the engine reads it.
export function waitsToBeBroughtUp(content: string): boolean {
  const verdict = classifyStateVersion(content);
  return verdict.kind === "past" && hasStateUpgrade(verdict.version);
}

// The text half of every step from `from` to the current version: each step's
// rewrite, then the next stage as this graph routes it (a stage the newer graph
// added comes first), which status reads; a scope the graph does not know
// keeps its field.
function upgradePlan(content: string, from: string): {
  text: string;
  version: string;
  renamed: StageRename[];
  added: string[];
  movedBehind: string[];
  passedOver: string[];
  steps: StateUpgrade[];
} {
  let text = content;
  let version = from;
  const renamed: StageRename[] = [];
  const added: string[] = [];
  const movedBehind: string[] = [];
  const passedOver: string[] = [];
  const steps: StateUpgrade[] = [];
  while (hasStateUpgrade(version)) {
    const step = STATE_UPGRADES[version];
    const reordered = step.reorder?.(text);
    text = upgradedText(text, step);
    renamed.push(...step.renamed);
    added.push(...step.added);
    movedBehind.push(...(reordered?.movedBehind ?? []));
    passedOver.push(...(reordered?.keptPassedOver ?? []));
    steps.push(step);
    version = step.to;
  }
  // The stage the work goes to next, which status reads: one the new order put
  // behind the cursor, which `next` goes back to at the next boundary, else the
  // next one this graph routes to (a stage the newer graph added comes first);
  // a scope the graph does not know keeps its field.
  const after = (movedBehind.length > 0 ? findStageBySlug(movedBehind[0]) : undefined) ??
    nextInScopeStage(getField(text, "Current Stage") ?? "", getField(text, "Scope") ?? "", text);
  if (after) text = setField(text, "Next Stage", after.slug);
  return { text, version, renamed, added, movedBehind, passedOver, steps };
}

/**
 * The state text as AI-DLC's next step brings it up, written nowhere: what a
 * reader that writes nothing (status, the status line, the session-start
 * context) shows, so the work reads
 * as it will once that step has run. The record's folders stay where the
 * earlier release kept them until then. Text no step brings up comes back as
 * it was.
 */
export function broughtUpStateText(content: string): string {
  const verdict = classifyStateVersion(content);
  return verdict.kind === "past" && hasStateUpgrade(verdict.version) ? upgradePlan(content, verdict.version).text : content;
}

// The record folders a stage rename moves: its phase folder, from where the
// release that wrote the record kept it, and its sensor folder.
function renamedFolders(r: StageRename): FolderMove[] {
  const toPhase = findStageBySlug(r.to)?.phase;
  return [
    ...(toPhase ? [{ from: `${r.fromPhase}/${r.from}`, to: `${toPhase}/${r.to}` }] : []),
    { from: `.aidlc-sensors/${r.from}`, to: `.aidlc-sensors/${r.to}` },
  ];
}

/**
 * The bring-up AI-DLC's next step makes on a record, written nowhere, for
 * status, which writes nothing: the state text (broughtUpStateText), and the
 * stages the step's audit row will name and the folders it will move, which
 * the count of the stages still to run reads (plannedStages), so status counts
 * before the step what it counts after it. Null for a record no step brings up.
 */
export function pendingBringUp(content: string, recordDir: string): { text: string; pending: BringUpAhead } | null {
  const verdict = classifyStateVersion(content);
  if (verdict.kind !== "past" || !hasStateUpgrade(verdict.version)) return null;
  const { text, renamed, added, movedBehind, steps } = upgradePlan(content, verdict.version);
  // A rename never moves onto a folder already there (moveRecordFolder).
  const renames = renamed.flatMap(renamedFolders).filter(({ to }) => !existsSync(join(recordDir, ...to.split("/"))));
  const moves = [...renames, ...steps.flatMap((step) => step.plan?.(recordDir) ?? [])];
  return { text, pending: { added, movedBehind, moves } };
}

// Moves one record folder to its new path. Nothing moves when the source is
// absent or the target already exists, so a repeated step is a no-op and no
// folder is overwritten or deleted; the target's parent folders are created.
// Returns the rename made, null when nothing moved, or the file system's
// refusal.
function moveRecordFolder(recordDir: string, from: string, to: string): FolderRename | FolderRefusal | null {
  const source = join(recordDir, ...from.split("/"));
  const target = join(recordDir, ...to.split("/"));
  if (!existsSync(source) || existsSync(target)) return null;
  return renameRecordFolder(source, target, from);
}

// The state as it was, kept beside it: aidlc-state.v<N>.md, or, when that
// already holds other text (work put back by hand on the earlier release,
// carried on there and brought up again), the first free
// aidlc-state.v<N>.<k>.md, so a kept original is never overwritten. Returns
// the name kept, which the audit row's Original names.
function keepOriginal(recordDir: string, version: string, content: string): string {
  for (let k = 1; ; k++) {
    const name = k === 1 ? `aidlc-state.v${version}.md` : `aidlc-state.v${version}.${k}.md`;
    const path = join(recordDir, name);
    if (!existsSync(path)) {
      writeFileAtomic(path, content);
      return name;
    }
    if (readFileSync(path, "utf-8") === content) return name;
  }
}

// The person's line for the bring-up this process last tried, when the file
// system held it back; null when it finished, or none was tried.
let heldBack: string | null = null;

/**
 * The person's one line when the bring-up the last state read tried could
 * not move a record folder (one a program holds open, one this user cannot
 * change, a mount in the way, or a full drive), naming the folders and the
 * step that frees them (heldBackLine); null otherwise. The record is then as
 * the earlier release left it, still at its State Version, and the next read
 * makes the whole bring-up again; next (a claim or release too) and report say
 * the line and stop, so nothing is asked and no stage is routed against
 * folders that did not move.
 */
export function heldBackBringUp(): string | null {
  return heldBack;
}

// The bring-up a read-only engine probe's state read left unmade, as status
// reads it (pendingBringUp); null for any other read.
let probed: BringUpAhead | null = null;

/**
 * For the engine's routing reads in a read-only probe (the Stop hook's, a
 * route check): the bring-up the step that comes after it will make, which
 * the probe may not write, so the stage it goes back to is the step's
 * (owedJumpBack and the stage count read it as status does). Null outside a
 * probe, and for a record no step brings up.
 */
export function probedBringUp(): BringUpAhead | null {
  return probed;
}

// What may have kept the file system from making a folder move, each with a
// step that frees it. Windows refuses a folder held open with EBUSY or EPERM,
// and one the user may not change with EPERM or EACCES. A Linux or macOS drive
// of its own never refuses an open folder, but a Windows drive under WSL
// (/mnt/c) and a network share do, as EACCES, EPERM or EBUSY. So a folder this
// user cannot change is said alone only when the file system says the drive
// is read-only (EROFS) or the access check finds that folder
// (unwritableFolderFor), which it cannot on Windows; any other refusal names
// both, so the step that works is always named. Away from Windows, EBUSY is
// also a folder something is mounted on, and EXDEV one on another mount than
// where it goes, on any platform; a mount cannot be renamed away, and
// unmounting it would leave what it holds behind, so the step is to move
// what is in it by hand. ENOSPC and EDQUOT are a full drive.
type Cause = "open" | "cannot change" | "mounted" | "full";

// The order the line names them in: an open folder, the likeliest, first.
const CAUSES: readonly Cause[] = ["open", "cannot change", "mounted", "full"];

function causesOf(recordDir: string, move: FolderMove, platform: NodeJS.Platform): Cause[] {
  switch (move.code) {
    case "EROFS":
      return ["cannot change"];
    case "ENOSPC":
    case "EDQUOT":
      return ["full"];
    case "EXDEV":
      return ["mounted"];
    case "EBUSY":
      return platform === "win32" ? ["open"] : ["open", "mounted"];
  }
  return unwritableFolderFor(recordDir, move, platform) === null ? ["open", "cannot change"] : ["cannot change"];
}

// A record-relative path as the person finds it from the project, `/`-separated.
function projectPath(projectDir: string, recordDir: string, path: string): string {
  return relative(projectDir, join(recordDir, ...path.split("/"))).split("\\").join("/");
}

function listed(names: readonly string[]): string {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// Clauses that are each a possible reason: "a, or b", "a, b, or c".
function eitherOf(clauses: readonly string[]): string {
  return clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")}, or ${clauses.at(-1)}`;
}

// The folders this user cannot change, as shown, why that may be, and the
// pronoun that stands for them: the one wording the held line, doctor and
// status share.
function cannotChange(folders: readonly string[]) {
  const one = folders.length === 1;
  return {
    folders: listed(folders),
    why: one
      ? "another user or a container may own it, or it may be read-only"
      : "another user or a container may own them, or they may be read-only",
    it: one ? "it" : "them",
  };
}

/**
 * The held line for `failed`, the moves the file system refused, on
 * `platform`. A folder this user cannot change, and nothing else, is named as
 * the access check finds it (else the move's own) with the write access that
 * frees it. Otherwise the line names the move and every reason the refusal
 * may have, with a step for each: what to close when a program may have the
 * folder open, then, if nothing has, the write access, the move by hand or
 * the space that frees it.
 */
export function heldBackLine(
  projectDir: string,
  recordDir: string,
  failed: readonly FolderMove[],
  platform: NodeJS.Platform = process.platform,
): string {
  const found = new Set(failed.flatMap((move) => causesOf(recordDir, move, platform)));
  const causes = CAUSES.filter((cause) => found.has(cause));
  const shown = (path: string) => `\`${projectPath(projectDir, recordDir, path)}\``;
  const carryOn = "ask me to carry on, and AI-DLC finishes moving your work and picks up where you were.";
  if (causes.length === 1 && causes[0] === "cannot change") {
    const folders = [...new Set(failed.map((move) => unwritableFolderFor(recordDir, move, platform) ?? move.from))];
    const words = cannotChange(folders.map(shown));
    return `AI-DLC cannot change ${words.folders} (${words.why}), so it could not move your work to where this ` +
      `release keeps it. Your work is as it was. Give your user write access to ${words.it}, then ${carryOn}`;
  }
  const one = failed.length === 1;
  const names = failed.map((move) => shown(move.from));
  const where = one
    ? `${names[0]} to ${shown(failed[0].to)}, where this release keeps it`
    : `${listed(names)} to where this release keeps them`;
  const those = one ? "that folder" : "those folders";
  const it = one ? "it" : "them";
  const why: Record<Cause, string> = {
    open: `a program on this computer has ${those} open`,
    "cannot change": `your user cannot change ${it}`,
    mounted: "something is mounted there (a container's volume or a network drive)",
    full: "the drive is full",
  };
  const step: Record<Cause, string> = {
    open: `close what has ${it} open (a dev server or test watcher still running over the project, a terminal or ` +
      "an editor inside, a file sync or backup app)",
    "cannot change": `give your user write access to ${it}`,
    mounted: one
      ? `move what is in it to ${shown(failed[0].to)} yourself`
      : "move what is in each to where this release keeps it yourself " +
        `(${listed(failed.map((move) => `${shown(move.from)} to ${shown(move.to)}`))})`,
    full: "free some space on the drive",
  };
  const [first, ...rest] = causes;
  const steps = rest.length === 0
    ? `${sentence(step[first])}, then ${carryOn}`
    : first === "open"
    ? `${sentence(step.open)}; if nothing has ${it} open, ${eitherOf(rest.map((cause) => step[cause]))}. ` +
      `Then ${carryOn}`
    : `${sentence(eitherOf(causes.map((cause) => step[cause])))}. Then ${carryOn}`;
  return `AI-DLC could not move ${where}: ${eitherOf(causes.map((cause) => why[cause]))}. Your work is as it was. ${steps}`;
}

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * For doctor and status, which write nothing: the folders this user cannot
 * change that the bring-up of a record still waiting for it has to move,
 * named as the held line names them, with why that may be and the pronoun
 * for them; null when there is none. Windows cannot tell such a folder from
 * the outside (unwritableFolderFor), and no platform can tell a folder a
 * program holds open, a mount in the way or a full drive without trying the
 * move, so for those only the step's own line names the folder, and doctor
 * and status say that it will.
 */
export function bringUpWaitsOn(
  projectDir: string,
  statePath: string,
  content: string,
): { folders: string; why: string; it: string } | null {
  const recordDir = dirname(statePath);
  const moves = pendingBringUp(content, recordDir)?.pending.moves;
  if (moves === undefined) return null;
  const folders = [...new Set(moves.flatMap((move) => {
    const blocked = existsSync(join(recordDir, ...move.from.split("/"))) ? unwritableFolderFor(recordDir, move) : null;
    return blocked === null ? [] : [blocked];
  }))];
  return folders.length === 0 ? null : cannotChange(folders.map((folder) => projectPath(projectDir, recordDir, folder)));
}

// The content as the current State Version reads it. When the version is one
// a step brings up, each renamed stage's record folders move to the new name
// and phase folder, then each step's own folder moves run (the 8 step's
// five-phase folders); once every move is made, the state as it was is kept
// beside it (keepOriginal), the state is written and one audit row says what
// changed and what was left behind. A read-only engine probe gets the
// brought-up text and writes nothing. A folder the file system will not let
// move holds the whole bring-up back: every move is put back, nothing is kept
// or written, the state stays at its version and this read gets the record as
// it is (so nothing in this command writes a brought-up state over folders
// that did not move), and the next read makes the whole move again, its row
// listing every move and its copy keeping the state as it stands then
// (heldBackBringUp names the folder meanwhile). A write that fails leaves the
// original whole (the copy comes first, the state by rename) and this step
// carries on with the brought-up text; the next one tries again.
export function bringStateUpToDate(
  projectDir: string,
  statePath: string,
  content: string,
  intent?: string,
  space?: string,
): string {
  heldBack = null;
  probed = null;
  if (!waitsToBeBroughtUp(content)) return content;
  const verdict = classifyStateVersion(content);
  if (verdict.kind !== "past") return content;
  const { text, version, renamed, added, movedBehind, passedOver, steps } = upgradePlan(content, verdict.version);
  // A probe writes nothing, so it hands the step's row and folder moves to the
  // reads that route the stage the work goes back to (probedBringUp), and
  // routes that stage as the step does. The rest of the record (a stage's
  // documents and their handoffs, the Units' folders) it reads where the
  // earlier release kept it, so there it can route a stage-level step or the
  // agent's own recovery where the step routes a Unit's step or the gate. It
  // need not agree: such a record has had no step since the update, the Stop
  // hook lets an attended turn end on pending work and hands an unattended one
  // back to `next`, and a route check that refuses a Unit's start names `next`;
  // either `next` brings the record up and routes it.
  if (isReadOnlyEngineProbe()) {
    probed = pendingBringUp(content, dirname(statePath))?.pending ?? null;
    return text;
  }
  try {
    const recordDir = dirname(statePath);
    const moved: string[] = [];
    const renames: FolderRename[] = [];
    const failed: FolderMove[] = [];
    for (const { from, to } of renamed.flatMap(renamedFolders)) {
      const result = moveRecordFolder(recordDir, from, to);
      if (result === null) continue;
      if ("refused" in result) failed.push({ from, to, code: result.refused });
      else {
        renames.push(result);
        moved.push(`${from} to ${to}`);
      }
    }
    const left: string[] = [];
    for (const step of failed.length > 0 ? [] : steps) {
      const result = step.folders?.(recordDir);
      if (!result) continue;
      failed.push(...result.failed);
      moved.push(...result.moved);
      left.push(...result.left);
    }
    if (failed.length > 0) {
      putFolderMovesBack(renames);
      heldBack = heldBackLine(projectDir, recordDir, failed);
      return content;
    }
    const kept = keepOriginal(recordDir, verdict.version, content);
    withAuditLock(projectDir, () => {
      writeStateFile(projectDir, text, intent, space);
      appendAuditEntryUnlocked("STATE_UPGRADED", {
        From: verdict.version,
        To: version,
        Renamed: renamed.map((r) => `${r.from} to ${r.to}`).join(", "),
        "Stages added": added.join(", "),
        "Stages moved behind": movedBehind.length > 0 ? movedBehind.join(", ") : "none",
        "Stages passed over": passedOver.length > 0 ? passedOver.join(", ") : "none",
        Moved: moved.length > 0 ? moved.join(", ") : "none",
        "Left behind": left.length > 0 ? left.join(", ") : "none",
        Original: kept,
      }, projectDir, intent, space);
    }, intent, space);
  } catch {
    // The original stays as it was; the next step tries again.
  }
  return text;
}

// The latest bring-up the record holds, for doctor and status to show on purpose.
export function stateUpgradeRecord(
  projectDir: string,
  intent?: string,
  space?: string,
): { from: string; date: string; original: string } | null {
  try {
    const row = readAuditShardEvents(projectDir, intent, space)
      .filter((e) => e.event === STATE_UPGRADED_EVENT)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .at(-1);
    if (!row) return null;
    return {
      from: auditBlockField(row.block, "From") ?? "",
      date: row.timestamp.slice(0, 10),
      original: auditBlockField(row.block, "Original") ?? "",
    };
  } catch {
    return null;
  }
}

// --- A record a newer AI-DLC wrote ---

interface NewerStateVersion {
  // The first release that writes it.
  release: string;
  // For a version a release outside this line writes, the work it is written
  // for there. No release of this line reads it, so updating never carries
  // such work on.
  otherLine?: string;
}

// The release that writes each State Version newer than this build reads, so
// the person hears which AI-DLC their teammate's work needs. A version a later
// release of this line writes names the first one that does, never the one
// that did, so it is said "or newer". Upstream AI-DLC 2.12 writes 9 on team
// work (#2783), which this line skips (its step from 8 goes to 10): no release
// of it reads 9, so the person hears where that work carries on, never an
// update.
export const STATE_VERSION_RELEASES: Readonly<Record<string, NewerStateVersion>> = Object.freeze({
  "9": { release: "2.12", otherLine: "team work" },
});

function knownNewerVersion(version: string): NewerStateVersion | undefined {
  return Object.hasOwn(STATE_VERSION_RELEASES, version) ? STATE_VERSION_RELEASES[version] : undefined;
}

/** The AI-DLC a newer State Version needs, as the person reads it. */
export function newerStateRelease(version: string): string {
  const known = knownNewerVersion(version);
  if (known === undefined) return "a newer AI-DLC";
  return known.otherLine === undefined ? `AI-DLC ${known.release} or newer` : `AI-DLC ${known.release} ${known.otherLine}`;
}

/** Whether updating AI-DLC carries the work on: not for a version only a release outside this line reads. */
export function updateCarriesOn(version: string): boolean {
  return knownNewerVersion(version)?.otherLine === undefined;
}

/**
 * How this computer gets a newer AI-DLC: the native `aidlc` updates itself; a
 * copy installed by hand, a pinned project and a package manager's install
 * each have their own step, which AI-DLC names and never takes for them.
 */
export type NewerWorkInstall =
  | { kind: "native" }
  | { kind: "copy" }
  | { kind: "pinned" }
  | { kind: "managed"; name: string; remediation: string };

export function newerWorkInstall(projectDir: string): NewerWorkInstall {
  if (aidlcInvocation() !== "aidlc") return { kind: "copy" };
  if (existsSync(join(projectDir, ".aidlc-version"))) return { kind: "pinned" };
  const executable = compiledExecutable();
  const manager = executable ? packageManagerForExecutable(executable) : null;
  return manager ? { kind: "managed", ...manager } : { kind: "native" };
}

// The project's own refresh, for the harness this runs in.
function refreshCommand(projectDir: string): string {
  return `${aidlcInvocation()} config --harness ${typedHarnessName(runtimeHarnessName(projectDir))}`;
}

/** The refresh the update is followed by, as the agent runs it. */
export function newerWorkRefresh(projectDir: string): string {
  return `${refreshCommand(projectDir)} --yes`;
}

/** What the work's first sentence names: the plan asked about, or the work selected when the request is new work. */
export function newerWorkLead(version: string, newWork = false): string {
  return `${newWork ? "The work selected here" : "This plan"} was set up with ${newerStateRelease(version)}`;
}

// The release host a copy's runtime comes from, as config names it, for the
// release line named (an upstream line such as 2.12 is published upstream); an
// unreadable machine setting names the configured mirror.
function releaseHost(release?: string): string {
  try {
    return releaseHostLabel(undefined, release ? `${release}.0` : undefined);
  } catch {
    return "the configured release mirror";
  }
}

/**
 * The person's one line for a record a newer AI-DLC wrote, with this
 * install's one step to carry on: for every place that cannot ask (doctor,
 * the terminal unit commands, and the installs AI-DLC does not update itself).
 */
export function newerStateStep(projectDir: string, version: string, newWork = false): string {
  const lead = newerWorkLead(version, newWork);
  const needs = newerStateRelease(version);
  const install = newerWorkInstall(projectDir);
  const refresh = `\`${newerWorkRefresh(projectDir)}\``;
  if (!updateCarriesOn(version)) return otherLineStep(projectDir, version, lead, install);
  switch (install.kind) {
    case "copy":
      return `${lead}, and this project has AI-DLC ${AIDLC_VERSION}, copied in by hand. To carry on, get the copy ` +
        `runtime of ${needs} (aidlc-copy-runtime-<version>.tar.gz and its .sha256, from the releases on ` +
        `${releaseHost()}) into one folder, then run \`${refreshCommand(projectDir)} --from <that file>\` in this project.`;
    case "pinned":
      return `${lead}, and this project is pinned to AI-DLC ${AIDLC_VERSION} in .aidlc-version. To carry on, pin it ` +
        `to the release your teammate uses with \`${aidlcInvocation()} config --pin <that version> --yes\`; the pin changes for ` +
        "everyone on the project.";
    case "managed":
      return `${lead}, and this computer has ${AIDLC_VERSION} from ${install.name}. ` +
        carryOnStep(install, "`aidlc update`", refresh);
    default:
      return `${lead}, and this computer has ${AIDLC_VERSION}. ${carryOnStep(install, "`aidlc update`", refresh)}`;
  }
}

// Work a release outside this line set up (State Version 9, upstream 2.12's
// team work): said once that this AI-DLC does not carry it on and an update
// will not, then the one step that does, on that release. A copy takes that
// release's copy runtime; any other install pins the project to it, which
// switches the AI-DLC serving the project for everyone on it, then refreshes
// the project's files to it.
function otherLineStep(projectDir: string, version: string, lead: string, install: NewerWorkInstall): string {
  const release = knownNewerVersion(version)?.release ?? "";
  const here = install.kind === "copy"
    ? `the AI-DLC ${AIDLC_VERSION} copied into this project by hand`
    : install.kind === "pinned"
    ? `AI-DLC ${AIDLC_VERSION}, which this project is pinned to,`
    : install.kind === "managed"
    ? `AI-DLC ${AIDLC_VERSION} from ${install.name}`
    : `AI-DLC ${AIDLC_VERSION} on this computer`;
  const step = install.kind === "copy"
    ? `To carry on, get the copy runtime of the AI-DLC ${release} release your teammate uses ` +
      `(aidlc-copy-runtime-<version>.tar.gz and its .sha256, from the releases on ${releaseHost(release)}) into one folder, ` +
      `then run \`${refreshCommand(projectDir)} --from <that file>\` in this project.`
    : `To carry on, pin this project to the ${release} release your teammate uses with ` +
      `\`${aidlcInvocation()} config --pin <that version> --yes\`, then run \`${newerWorkRefresh(projectDir)}\`; ` +
      "the pin changes for everyone on the project.";
  return `${lead}, which ${here} does not carry on, and updating AI-DLC does not change that. ${step}`;
}

/** The one step to a newer AI-DLC: `update` natively, a package manager's own update, then `refresh`. */
export function carryOnStep(install: NewerWorkInstall, update: string, refresh: string, how = ""): string {
  return `To carry on${how}: ${install.kind === "managed" ? install.remediation : update}, then ${refresh} in this project.`;
}
