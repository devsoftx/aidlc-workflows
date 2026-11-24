import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findStageBySlug,
  isPerUnitStage,
  loadStageGraphAll,
  relativeSpaceRecordPrefix,
  UNIT_RECORD_PHASES,
} from "./aidlc-lib.ts";

// The record phase folder a stage writes its record in. A slug the graph does
// not know keeps the build folder, where the per-Unit code stage writes.
function stageRecordPhase(stageSlug: string): string {
  return findStageBySlug(stageSlug)?.phase ?? "build";
}

// `<prefix>/<phase>/<unit>/<stage>/memory.md`: one Unit's own diary for a
// per-Unit stage, the path a per-Unit wave entry and the run-stage directive
// name.
export function unitMemoryPath(stageSlug: string, unit: string, recordPrefix: string | null): string {
  const prefix = recordPrefix ?? relativeSpaceRecordPrefix();
  return `${prefix}/${stageRecordPhase(stageSlug)}/${unit}/${stageSlug}/memory.md`;
}

// A per-Unit stage's step for a named Unit keeps its notes in the Unit's own
// folder, whoever owns the Unit, so each unit-record phase folder holds Unit
// folders beside its stage-level stages' folders. Null when the stage-level
// diary applies. The run-stage directive and the learnings step both read it
// here.
export function unitStageMemoryPath(
  stage: { slug: string; for_each?: string },
  unit: string | null,
  recordPrefix: string | null,
): string | null {
  if (!unit || !isPerUnitStage(stage)) return null;
  return unitMemoryPath(stage.slug, unit, recordPrefix);
}

// The texts of a per-Unit stage's Unit diaries under the record dir `record`:
// the named Unit's, or every Unit's in name order. Work started before the
// notes moved keeps the stage-level diary too; the reader reads it as well.
export function unitStageDiaryTexts(record: string, slug: string, unit: string | null): string[] {
  const phase = stageRecordPhase(slug);
  const units = unit ? [unit] : unitFolderNames(record);
  return units
    .map((name) => join(record, phase, name, slug, "memory.md"))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf-8"));
}

// The Unit folders of a record: the names in each unit-record phase folder,
// less the stage folders that sit beside them, so a stage folder is never read
// as a Unit.
function unitFolderNames(record: string): string[] {
  const stageSlugs = new Set(loadStageGraphAll().map((stage) => stage.slug));
  const names = new Set<string>();
  for (const unitPhase of UNIT_RECORD_PHASES) {
    let entries: string[];
    try {
      entries = readdirSync(join(record, unitPhase));
    } catch {
      continue;
    }
    for (const name of entries) if (!stageSlugs.has(name)) names.add(name);
  }
  return [...names].sort();
}

// An older stage-level diary without the copies a wave Unit's completion made
// of that Unit's own notes (each copied line followed by its
// `<!-- aidlc-wave-memory:... -->` marker): the Unit's own diary is read now,
// so a copy would count its note twice.
export function withoutWaveCopies(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/^[^\n]*\n<!-- aidlc-wave-memory:[^\n]*-->[ \t]*$/gm, "");
}
