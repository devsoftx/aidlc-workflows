// The plan sections of a state file, rendered from the stage graph: Stage
// Progress (one `### <PHASE> PHASE` heading per phase, the stage rows under
// it), the Phase Progress rows a plan change re-derives, and the plan fields
// (Stages to Execute and to Skip, Total Stages, Completed). One owner: the
// scope change, recompose and reclassify (aidlc-utility.ts) and the 8 to 10
// state step (aidlc-seven-phase-upgrade.ts) write them through here, so a
// record brought up reads like one this release writes. It imports neither of
// those modules, so both can import it.
import {
  loadStageGraph,
  nextInScopeStage,
  PHASES,
  parseStateStageSuffixes,
  setPhaseProgress,
  type StageEntry,
} from "./aidlc-lib.ts";
import { isUnitLoopStage, PHASE_LABELS } from "./aidlc-phases.ts";
import { getField, parseCheckboxes, setField } from "./aidlc-record-core.ts";

const STAGE_PROGRESS_HEADER =
  "## Stage Progress\n<!-- Checkbox states: [ ] not started, [-] in progress, [?] awaiting approval (gate open), [R] revising (user rejected gate), [x] completed, [S] skipped via --stage/--phase jump -->\n";

// The Stage Progress section as every writer writes it: its heading, the
// checkbox comment under it, and its body up to the next `## ` section. A
// hand-written record without the comment is left as it is. A Windows clone
// checks the state file out with CRLF line endings, so the section is found
// with either ending.
const STAGE_PROGRESS_SECTION = /## Stage Progress\r?\n<!-- [^\r\n]* -->\r?\n([\s\S]*?)(?=\r?\n## (?!Stage Progress))/;

/** The lines of the Stage Progress body, without line endings; null when the content has no such section. */
export function stageProgressLines(content: string): string[] | null {
  const section = STAGE_PROGRESS_SECTION.exec(content);
  return section === null ? null : section[1].split(/\r?\n/);
}

/**
 * The content with its Stage Progress section rebuilt in the graph's order:
 * one `### <PHASE> PHASE` heading per phase, the content's Per unit line (when
 * it has one) under the first phase that holds a per-Unit stage, and under each
 * heading the rows `rowsFor` gives each of the phase's stages. `following`
 * places lines the graph has no stage for right after the rows of the slug
 * they followed; the key "" puts them at the top of the first phase, and a
 * slug the graph does not render puts them at the end. The section is written
 * back in the content's own line endings, and content with no such section
 * comes back as it was.
 */
export function withStageProgress(
  content: string,
  graph: readonly StageEntry[],
  rowsFor: (stage: StageEntry) => readonly string[],
  following: ReadonlyMap<string, readonly string[]> = new Map(),
): string {
  const section = STAGE_PROGRESS_SECTION.exec(content);
  if (section === null) return content;
  const unitLoopPhase = graph.find((stage) => isUnitLoopStage(stage))?.phase;
  const perUnit = content.match(/^Per unit:.*$/m)?.[0];
  const placed = new Set<string>();
  const lines = (key: string): string => {
    placed.add(key);
    return (following.get(key) ?? []).map((line) => `${line}\n`).join("");
  };
  let body = "";
  for (const phase of PHASES) {
    body += `\n### ${PHASE_LABELS[phase]} PHASE\n`;
    if (phase === unitLoopPhase && perUnit) body += `${perUnit}\n`;
    if (phase === PHASES[0]) body += lines("");
    for (const stage of graph) {
      if (stage.phase !== phase) continue;
      body += rowsFor(stage).map((row) => `${row}\n`).join("");
      body += lines(stage.slug);
    }
  }
  for (const key of following.keys()) if (!placed.has(key)) body += lines(key);
  const eol = section[0].includes("\r\n") ? "\r\n" : "\n";
  return content.slice(0, section.index) + (STAGE_PROGRESS_HEADER + body).replaceAll("\n", eol) +
    content.slice(section.index + section[0].length);
}

/**
 * The Phase Progress rows not yet reached (Pending or Skipped) re-derived from
 * the plan: Pending when one of the phase's stages runs, Skipped when none
 * does. Active and Verified rows are history and stay as they are.
 */
export function withUnreachedPhasesRederived(
  content: string,
  graph: readonly StageEntry[],
  runs: (slug: string) => boolean,
): string {
  let next = content;
  for (const phase of PHASES) {
    const row = getField(next, phase.charAt(0).toUpperCase() + phase.slice(1));
    if (row !== "Pending" && row !== "Skipped") continue;
    next = setPhaseProgress(next, phase, graph.some((s) => s.phase === phase && runs(s.slug)) ? "Pending" : "Skipped");
  }
  return next;
}

// The slug a `<number> (<slug>)` plan-field token names, less a note after an
// em dash (the greenfield Reverse Engineering skip); the token itself when it
// has no such shape.
function slugOfPlanToken(token: string): string {
  const m = /^\S+ \((.+)\)$/.exec(token);
  return (m ? m[1] : token).split(" — ")[0];
}

function planTokens(row: string | null): string[] {
  const value = (row ?? "").trim();
  return value === "" || value === "none" ? [] : value.split(", ");
}

/**
 * Rebuild the plan's derived fields after stage suffix flips, against the
 * EFFECTIVE plan (suffix over scope grid): Stages to Execute / to Skip / Total
 * / Completed, the not-yet-reached Phase Progress rows, and Next Stage (when
 * `currentSlug` is given). Shared by recompose and reclassify so both describe
 * a plan the same way, and by the 8 to 10 state step with `renumber`.
 * `skipLabel` renders a newly skipped stage's Stages to Skip entry.
 *
 * The Stages to Skip row carries creation/scope-change annotations (entry
 * shape "<number> (<slug>)", or the greenfield note on reverse-engineering)
 * that a bare-slug rebuild would destroy. Each existing entry is kept
 * VERBATIM, in its existing position, while its stage is still skipped;
 * entries whose stage was promoted are dropped; newly skipped stages are
 * appended in graph order. A skip+add round trip therefore leaves the row
 * byte-identical. With `renumber`, both lists are written in graph order with
 * this graph's numbers: a skipped stage's entry keeps the text it had in
 * parentheses byte for byte (the greenfield note), and an entry of either list
 * whose stage this graph does not know (a plugin's) is kept as it was, after
 * the rest.
 */
export function rebuildEffectivePlanFields(
  content: string,
  scope: string,
  scopeDef: { stages: Record<string, string> },
  currentSlug: string,
  skipLabel: (stage: StageEntry) => string = (stage) => `${stage.number} (${stage.slug})`,
  options: { renumber?: boolean } = {},
): { content: string; executeStages: string[]; completedCount: number } {
  const graph = loadStageGraph();
  const bySlug = new Map(graph.map((s) => [s.slug, s]));
  const postSuffixes = parseStateStageSuffixes(content);
  const eff = (slug: string): "EXECUTE" | "SKIP" => {
    const v = postSuffixes.get(slug) ?? scopeDef.stages[slug];
    return v === "EXECUTE" ? "EXECUTE" : "SKIP";
  };
  const executeStages: string[] = [];
  const skipStages: string[] = [];
  const priorSkips = planTokens(getField(content, "Stages to Skip"));
  if (options.renumber) {
    // Both lists in graph order with this graph's numbers; a skipped stage
    // keeps the text its entry had in parentheses, and an entry naming a
    // stage the graph does not know follows the rest as it was.
    const kept = new Map<string, string>();
    const unknown: string[] = [];
    for (const token of priorSkips) {
      const shape = /^\S+ (\(.+\))$/.exec(token);
      const slug = slugOfPlanToken(token);
      if (shape && !bySlug.has(slug)) unknown.push(token);
      else if (shape && !kept.has(slug)) kept.set(slug, shape[1]);
    }
    for (const s of graph) {
      if (eff(s.slug) === "EXECUTE") executeStages.push(`${s.number} (${s.slug})`);
      else skipStages.push(kept.has(s.slug) ? `${s.number} ${kept.get(s.slug)}` : skipLabel(s));
    }
    skipStages.push(...unknown);
    for (const token of planTokens(getField(content, "Stages to Execute"))) {
      if (/^\S+ \(.+\)$/.test(token) && !bySlug.has(slugOfPlanToken(token))) executeStages.push(token);
    }
  } else {
    const preservedSlugs = new Set<string>();
    for (const token of priorSkips) {
      const slug = slugOfPlanToken(token);
      if (bySlug.has(slug) && eff(slug) === "SKIP") {
        skipStages.push(token);
        preservedSlugs.add(slug);
      }
    }
    for (const s of graph) {
      if (eff(s.slug) === "EXECUTE") executeStages.push(`${s.number} (${s.slug})`);
      else if (!preservedSlugs.has(s.slug)) skipStages.push(skipLabel(s));
    }
  }
  let next = setField(content, "Stages to Execute", executeStages.join(", "));
  next = setField(next, "Stages to Skip", skipStages.length > 0 ? skipStages.join(", ") : "none");
  next = setField(next, "Total Stages", String(executeStages.length));
  const completedCount = parseCheckboxes(next).filter(
    (c) => c.state === "completed" && eff(c.slug) === "EXECUTE",
  ).length;
  next = setField(next, "Completed", String(completedCount));
  // A flip can empty a phase of EXECUTE stages (-> Skipped) or give a Skipped
  // phase its first (-> Pending).
  next = withUnreachedPhasesRederived(next, graph, (slug) => eff(slug) === "EXECUTE");
  // The Next Stage projection over the new plan (override-aware).
  if (currentSlug) {
    const after = nextInScopeStage(currentSlug, scope, next);
    next = setField(next, "Next Stage", after ? after.slug : "none");
  }
  return { content: next, executeStages, completedCount };
}
