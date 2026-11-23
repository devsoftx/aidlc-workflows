// The 8 to 10 state step: a record a five-phase AI-DLC wrote (State Version 8,
// 2.6.1 to 2.11.4) laid out as the seven-phase one this release reads. Both
// halves work from stage slugs, never from an old phase name mapped to a new
// one (stages moved between phases), and both are idempotent:
// sevenPhaseStateText rewrites the state text, and moveFivePhaseFolders moves
// each stage's record folder by the frozen table in aidlc-five-phase-record.ts.
// The text half also reads a record a hook already wrote a seven-phase line
// into before the engine's first read (the sync hook sets Lifecycle Phase), and
// one a pre-release seven-phase build labelled 8. Doctor reads
// fivePhaseFolderPlan for what the move left behind, so it names the same move.
import { type Dirent, lstatSync, mkdirSync, readdirSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  FIVE_PHASE_FOLDERS,
  FIVE_PHASE_STAGE_FOLDER,
  FIVE_PHASE_UNIT_STAGES,
  SEVEN_PHASE_STAGE_FOLDER,
} from "./aidlc-five-phase-record.ts";
import {
  effectivePlanAction,
  loadScopeMapping,
  loadStageGraph,
  loadStageGraphAll,
  PHASES,
  type StageEntry,
} from "./aidlc-lib.ts";
import { isUnitLoopStage } from "./aidlc-phases.ts";
import { getField, parseCheckboxes, setField } from "./aidlc-record-core.ts";
import { rebuildEffectivePlanFields, stageProgressLines, withStageProgress } from "./aidlc-state-progress.ts";
import { renameRetryingOnWindows } from "./aidlc-workspace-sync.ts";

const STAGE_ROW = /^- \[[ xSR?-]\] (\S+)\s*—/;
const PHASE_HEADING = /^### [A-Z][A-Z ]* PHASE[ \t]*$/;
// The Phase Progress section as every writer writes it, its status comment
// first; like Stage Progress (withStageProgress), a hand-written one without
// the comment is left as it is.
const PHASE_PROGRESS_SECTION = /## Phase Progress\r?\n(<!-- [^\r\n]* -->)\r?\n([\s\S]*?)(?=\r?\n## (?!Phase Progress))/;
// The Phase Progress rows either layout writes; the section is rebuilt with the eight current ones.
const PHASE_PROGRESS_ROW =
  /^- \*\*(Initialization|Ideation|Inception|Construction|Operation|Discover|Design|Build|Test|Secure|Deploy|Operate)\*\*:/;

function phaseLabel(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function cursorStage(content: string): StageEntry | undefined {
  const current = (getField(content, "Current Stage") ?? "").trim();
  return loadStageGraphAll().find((stage) => stage.slug === current);
}

/**
 * The state text in the seven-phase layout: Stage Progress in the current
 * graph's order under its phase headings (every row kept, marker and suffix,
 * by slug; a row for each stage in `added` that has none, with the action
 * routing reads for a missing row; rows and lines the graph does not place
 * kept after the row they followed), the plan fields renumbered, Phase
 * Progress with the eight current phases, and Lifecycle Phase as the phase of
 * Current Stage. Text already in that layout comes back as it was.
 */
export function sevenPhaseStateText(content: string, added: readonly string[]): string {
  const graph = loadStageGraph();
  const scope = getField(content, "Scope") ?? "";
  let text = sevenPhaseStageProgress(content, graph, added, scope);
  text = rebuildEffectivePlanFields(text, scope, loadScopeMapping()[scope] ?? { stages: {} }, "", undefined, {
    renumber: true,
  }).content;
  text = sevenPhaseProgress(text, graph, scope);
  return sevenPhaseLifecycle(text);
}

function sevenPhaseStageProgress(content: string, graph: readonly StageEntry[], added: readonly string[], scope: string): string {
  const lines = stageProgressLines(content);
  if (lines === null) return content;
  const known = new Set(graph.map((stage) => stage.slug));
  const rows = new Map<string, string[]>();
  const following = new Map<string, string[]>();
  let after = "";
  let perUnitSeen = false;
  for (const line of lines) {
    if (line.trim() === "" || PHASE_HEADING.test(line)) continue;
    // The first Per unit line goes under the first phase with a per-Unit stage (withStageProgress).
    if (!perUnitSeen && /^Per unit:/.test(line)) {
      perUnitSeen = true;
      continue;
    }
    const slug = STAGE_ROW.exec(line)?.[1];
    if (slug !== undefined && known.has(slug)) {
      rows.set(slug, [...(rows.get(slug) ?? []), line]);
      after = slug;
    } else {
      following.set(after, [...(following.get(after) ?? []), line]);
    }
  }
  return withStageProgress(content, graph, (stage) => {
    const kept = rows.get(stage.slug);
    if (kept) return kept;
    if (!added.includes(stage.slug)) return [];
    return [`- [ ] ${stage.slug} — ${effectivePlanAction(stage.slug, scope, content) === "EXECUTE" ? "EXECUTE" : "SKIP"}`];
  }, following);
}

// Each phase's status from the graph, the rows and the cursor, as the
// transitions keep it: Initialization done, the cursor's phase Active (Verified
// once the work is finished), an earlier phase Verified when one of its stages
// finished and Skipped when none did, and a later one Pending when the plan
// still runs one of its stages and Skipped when it runs none.
function sevenPhaseProgress(content: string, graph: readonly StageEntry[], scope: string): string {
  const section = PHASE_PROGRESS_SECTION.exec(content);
  if (section === null) return content;
  const boxes = new Map<string, string>();
  for (const box of parseCheckboxes(content)) if (!boxes.has(box.slug)) boxes.set(box.slug, box.state);
  const cursor = cursorStage(content);
  const at = cursor ? PHASES.indexOf(cursor.phase as (typeof PHASES)[number]) : -1;
  const finished = (getField(content, "Status") ?? "").trim() === "Completed";
  const status = (phase: string, index: number): string => {
    if (index === at) return finished ? "Verified" : "Active";
    if (phase === "initialization") return "Verified";
    const stages = graph.filter((stage) => stage.phase === phase);
    const done = stages.some((stage) => boxes.get(stage.slug) === "completed");
    if ((at >= 0 && index < at) || (at < 0 && done)) return done ? "Verified" : "Skipped";
    const runs = stages.some((stage) =>
      boxes.get(stage.slug) !== "skipped" && effectivePlanAction(stage.slug, scope, content) === "EXECUTE");
    return runs ? "Pending" : "Skipped";
  };
  const others = section[2].split(/\r?\n/).filter((line) => line.trim() !== "" && !PHASE_PROGRESS_ROW.test(line));
  const body = [
    section[1],
    "",
    ...PHASES.map((phase, index) => `- **${phaseLabel(phase)}**: ${status(phase, index)}`),
    ...others,
  ].join("\n");
  const eol = section[0].includes("\r\n") ? "\r\n" : "\n";
  return content.slice(0, section.index) + `## Phase Progress\n${body}\n`.replaceAll("\n", eol) +
    content.slice(section.index + section[0].length);
}

// INITIALIZATION and READY name no delivery phase, so they stay; a Current
// Stage the graph does not know leaves the field as it was.
function sevenPhaseLifecycle(content: string): string {
  const now = getField(content, "Lifecycle Phase");
  if (now === null || now === "INITIALIZATION" || now === "READY") return content;
  const cursor = cursorStage(content);
  return cursor ? setField(content, "Lifecycle Phase", cursor.phase.toUpperCase()) : content;
}

// --- The record folders ---

export interface FolderMove {
  // Record-relative, with `/` between segments.
  from: string;
  to: string;
}

function entries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isSevenPhase(phase: string): boolean {
  return (PHASES as readonly string[]).includes(phase) && !(FIVE_PHASE_FOLDERS as readonly string[]).includes(phase);
}

// The seven-phase folder of a stage folder found under `old`: the frozen
// table's for a stage 2.11.4 shipped there, the graph's phase for a stage it
// did not ship (a plugin's, every stage the graph knows, disabled ones too).
function stageFolder(slug: string, old: string, graph: ReadonlyMap<string, StageEntry>): string | null {
  if (Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, slug)) {
    return FIVE_PHASE_STAGE_FOLDER[slug] === old ? SEVEN_PHASE_STAGE_FOLDER[slug] : null;
  }
  const stage = graph.get(slug);
  return stage && isSevenPhase(stage.phase) ? stage.phase : null;
}

// The seven-phase folder a per-Unit stage's Unit folders go under.
function unitStageFolder(slug: string, graph: ReadonlyMap<string, StageEntry>): string | null {
  if (FIVE_PHASE_UNIT_STAGES.includes(slug)) return SEVEN_PHASE_STAGE_FOLDER[slug];
  if (Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, slug)) return null;
  const stage = graph.get(slug);
  return stage && isUnitLoopStage(stage) && isSevenPhase(stage.phase) ? stage.phase : null;
}

/**
 * What the 8 to 10 step moves out of a record's five-phase folders, and what
 * no stage claims there (`unplaced`, record-relative). Under construction/, a
 * folder no stage is named after that holds a per-Unit stage's folder is a
 * Unit: each of its stage folders moves to `<phase>/<unit>/<slug>`, so one Unit
 * splits across design/ and build/.
 */
export function fivePhaseFolderPlan(recordDir: string): { moves: FolderMove[]; unplaced: string[] } {
  const graph = new Map(loadStageGraphAll().map((stage) => [stage.slug, stage]));
  const moves: FolderMove[] = [];
  const unplaced: string[] = [];
  for (const old of FIVE_PHASE_FOLDERS) {
    for (const entry of entries(join(recordDir, old))) {
      const from = `${old}/${entry.name}`;
      const target = entry.isDirectory() ? stageFolder(entry.name, old, graph) : null;
      if (target !== null) {
        moves.push({ from, to: `${target}/${entry.name}` });
        continue;
      }
      const unit = old === "construction" && entry.isDirectory() && !Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, entry.name) &&
        !graph.has(entry.name) ? entries(join(recordDir, old, entry.name)) : [];
      if (!unit.some((child) => child.isDirectory() && unitStageFolder(child.name, graph) !== null)) {
        unplaced.push(from);
        continue;
      }
      for (const child of unit) {
        const phase = child.isDirectory() ? unitStageFolder(child.name, graph) : null;
        if (phase === null) unplaced.push(`${from}/${child.name}`);
        else moves.push({ from: `${from}/${child.name}`, to: `${phase}/${entry.name}/${child.name}` });
      }
    }
  }
  return { moves, unplaced };
}

function removeIfEmpty(dir: string): void {
  try {
    rmdirSync(dir);
  } catch {
    // Not empty, or already gone: it stays as it is.
  }
}

// Moves `source` to `target`, or into it entry by entry when it is a folder
// already there, never over anything at the target. What could not move is
// returned by its record-relative `label`.
function mergeFolder(source: string, target: string, label: string): { moved: boolean; left: string[] } {
  if (!pathExists(target)) {
    try {
      mkdirSync(dirname(target), { recursive: true });
      renameRetryingOnWindows(source, target);
      return { moved: true, left: [] };
    } catch {
      return { moved: false, left: [label] };
    }
  }
  if (!isDirectory(source) || !isDirectory(target)) return { moved: false, left: [label] };
  let moved = false;
  const left: string[] = [];
  for (const entry of entries(source)) {
    const merged = mergeFolder(join(source, entry.name), join(target, entry.name), `${label}/${entry.name}`);
    moved ||= merged.moved;
    left.push(...merged.left);
  }
  removeIfEmpty(source);
  return { moved, left };
}

/**
 * Moves each stage folder out of the record's five-phase folders by
 * fivePhaseFolderPlan, then removes the old folders the moves left empty (a
 * Unit's, then the phase's own; never one that still holds something). Returns
 * the moves made (`<from> to <to>`) and every record-relative path left behind.
 */
export function moveFivePhaseFolders(recordDir: string): { moved: string[]; left: string[] } {
  const plan = fivePhaseFolderPlan(recordDir);
  const moved: string[] = [];
  const left = [...plan.unplaced];
  for (const { from, to } of plan.moves) {
    const merged = mergeFolder(join(recordDir, ...from.split("/")), join(recordDir, ...to.split("/")), from);
    if (merged.moved) moved.push(`${from} to ${to}`);
    left.push(...merged.left);
  }
  for (const old of FIVE_PHASE_FOLDERS) {
    const dir = join(recordDir, old);
    for (const entry of entries(dir)) if (entry.isDirectory()) removeIfEmpty(join(dir, entry.name));
    removeIfEmpty(dir);
  }
  return { moved, left: left.filter((path) => pathExists(join(recordDir, ...path.split("/")))) };
}

/**
 * Doctor's findings for a State Version 10 record that still holds five-phase
 * folders: each one AI-DLC no longer reads, with the one move that puts it
 * where it reads it now. `shownAs` is the record as the person reads its path.
 */
export function fivePhaseFolderFindings(recordDir: string, shownAs: string): { label: string; fix: string }[] {
  const plan = fivePhaseFolderPlan(recordDir);
  const at = (path: string) => `${shownAs}/${path}`;
  const lead = "Left where an earlier AI-DLC kept it, and not read there now:";
  return [
    ...plan.moves.map(({ from, to }) => ({
      label: `${lead} ${at(from)}`,
      fix: pathExists(join(recordDir, ...to.split("/")))
        ? `move what ${at(from)} holds into ${at(to)}, keeping the copy you want where both have a file`
        : `move ${at(from)} to ${at(to)}`,
    })),
    ...plan.unplaced.map((path) => ({
      label: `${lead} ${at(path)}`,
      fix: `move it into the folder of the stage it belongs to (${shownAs}/<phase>/<stage>), or delete it if nothing needs it`,
    })),
  ];
}
