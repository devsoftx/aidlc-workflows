// A record an earlier State Version wrote, brought up to the current one in
// place the first time the engine reads it, so work started on an older
// AI-DLC carries on after an update with nothing asked and nothing said.
// One owner: the engine's state read (loadStateFileIfPresent in
// aidlc-orchestrate.ts) calls bringStateUpToDate, doctor and status read
// hasStateUpgrade and stateUpgradeRecord, and status, the status line and the
// session-start context show broughtUpStateText before the step has run, so
// they never disagree with it.
// A record a newer AI-DLC wrote is never brought down: newerStateStep names
// the release it needs and the person's step, for next, report, doctor and the
// unit commands alike.
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { appendAuditEntryUnlocked } from "./aidlc-audit.ts";
import { classifyStateVersion, findStageBySlug, nextInScopeStage } from "./aidlc-lib.ts";
import { isReadOnlyEngineProbe, withAuditLock, writeFileAtomic } from "./aidlc-locks.ts";
import { auditBlockField, getField, readAuditShardEvents, setField, writeStateFile } from "./aidlc-record-core.ts";
import { packageManagerForExecutable } from "./aidlc-install-paths.ts";
import { releaseHostLabel } from "./aidlc-release.ts";
import { moveFivePhaseFolders, sevenPhaseStateText } from "./aidlc-seven-phase-upgrade.ts";
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
  // The step's own record-folder moves, after every rename's, and what they left behind.
  folders?: (recordDir: string) => { moved: string[]; left: string[] };
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
  steps: StateUpgrade[];
} {
  let text = content;
  let version = from;
  const renamed: StageRename[] = [];
  const added: string[] = [];
  const steps: StateUpgrade[] = [];
  while (hasStateUpgrade(version)) {
    const step = STATE_UPGRADES[version];
    text = upgradedText(text, step);
    renamed.push(...step.renamed);
    added.push(...step.added);
    steps.push(step);
    version = step.to;
  }
  const after = nextInScopeStage(getField(text, "Current Stage") ?? "", getField(text, "Scope") ?? "", text);
  if (after) text = setField(text, "Next Stage", after.slug);
  return { text, version, renamed, added, steps };
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

// Moves one record folder to its new path. Nothing moves when the source is
// absent or the target already exists, so a repeated step is a no-op and no
// folder is overwritten or deleted; the target's parent folders are created.
// Returns the audit label for the move, or null when nothing moved.
function moveRecordFolder(recordDir: string, from: string, to: string): string | null {
  const source = join(recordDir, ...from.split("/"));
  const target = join(recordDir, ...to.split("/"));
  if (!existsSync(source) || existsSync(target)) return null;
  mkdirSync(dirname(target), { recursive: true });
  renameSync(source, target);
  return `${from} to ${to}`;
}

// The content as the current State Version reads it. When the version is one
// a step brings up, the state as it was is kept beside it first
// (aidlc-state.v<N>.md), each renamed stage's record folders move to the new
// name and phase folder, then each step's own folder moves run (the 8 step's
// five-phase folders), the state is written and one audit row says what
// changed and what was left behind. A read-only engine probe gets the
// brought-up text and writes nothing. A write that fails leaves the original
// whole (the copy comes first, the state by rename) and this step carries on
// with the brought-up text; the next one tries again.
export function bringStateUpToDate(
  projectDir: string,
  statePath: string,
  content: string,
  intent?: string,
  space?: string,
): string {
  if (!waitsToBeBroughtUp(content)) return content;
  const verdict = classifyStateVersion(content);
  if (verdict.kind !== "past") return content;
  const { text, version, renamed, added, steps } = upgradePlan(content, verdict.version);
  if (isReadOnlyEngineProbe()) return text;
  try {
    const recordDir = dirname(statePath);
    const kept = join(recordDir, `aidlc-state.v${verdict.version}.md`);
    if (!existsSync(kept)) writeFileAtomic(kept, content);
    const moved: string[] = [];
    for (const r of renamed) {
      const toPhase = findStageBySlug(r.to)?.phase;
      const folders: [string, string][] = [[`.aidlc-sensors/${r.from}`, `.aidlc-sensors/${r.to}`]];
      if (toPhase) folders.unshift([`${r.fromPhase}/${r.from}`, `${toPhase}/${r.to}`]);
      for (const [from, to] of folders) {
        const label = moveRecordFolder(recordDir, from, to);
        if (label) moved.push(label);
      }
    }
    const left: string[] = [];
    for (const step of steps) {
      const result = step.folders?.(recordDir);
      if (!result) continue;
      moved.push(...result.moved);
      left.push(...result.left);
    }
    withAuditLock(projectDir, () => {
      writeStateFile(projectDir, text, intent, space);
      appendAuditEntryUnlocked("STATE_UPGRADED", {
        From: verdict.version,
        To: version,
        Renamed: renamed.map((r) => `${r.from} to ${r.to}`).join(", "),
        "Stages added": added.join(", "),
        Moved: moved.length > 0 ? moved.join(", ") : "none",
        "Left behind": left.length > 0 ? left.join(", ") : "none",
        Original: basename(kept),
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

// The release host a copy's runtime comes from, as config names it; an
// unreadable machine setting names the configured mirror.
function releaseHost(): string {
  try {
    return releaseHostLabel();
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
      `(aidlc-copy-runtime-<version>.tar.gz and its .sha256, from the releases on ${releaseHost()}) into one folder, ` +
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
