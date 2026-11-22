// Where a five-phase AI-DLC (State Version 8 and earlier, up to 2.11.4) kept
// each stage's record folder, and where the seven-phase layout keeps it. One
// owner for the translation: the 8 to 10 state step moves the folders with
// it, and every reader of recorded evidence (a questions-file path on an
// approval or summary record, an audit row's File, a review manifest's
// logical paths) accepts the five-phase spelling through it, so work approved
// or reviewed before the update still holds after the move.
//
// The tables are frozen: a later release that moves a stage again adds its own
// step and never changes what this one did. A leaf module: it imports nothing.

type FivePhase = "ideation" | "inception" | "construction" | "operation";

// The four phase folders a five-phase record holds stage work in. None of them
// is a seven-phase folder name, so a path segment spelled one of these can only
// have been written by a five-phase release.
export const FIVE_PHASE_FOLDERS: readonly FivePhase[] = ["ideation", "inception", "construction", "operation"];

// The five-phase folder of each stage 2.11.4 shipped.
export const FIVE_PHASE_STAGE_FOLDER: Readonly<Record<string, FivePhase>> = Object.freeze({
  "intent-capture": "ideation",
  "market-research": "ideation",
  feasibility: "ideation",
  "scope-definition": "ideation",
  "team-formation": "ideation",
  "rough-mockups": "ideation",
  "approval-handoff": "ideation",
  "reverse-engineering": "inception",
  "practices-discovery": "inception",
  "requirements-analysis": "inception",
  "user-stories": "inception",
  "refined-mockups": "inception",
  "domain-design": "inception",
  "units-generation": "inception",
  "contract-design": "inception",
  "delivery-planning": "inception",
  "functional-design": "construction",
  "nfr-requirements": "construction",
  "nfr-design": "construction",
  "infrastructure-design": "construction",
  "code-generation": "construction",
  "build-and-test": "construction",
  "ci-pipeline": "construction",
  "deployment-pipeline": "operation",
  "environment-provisioning": "operation",
  "deployment-execution": "operation",
  "observability-setup": "operation",
  "incident-response": "operation",
  "performance-validation": "operation",
  "feedback-optimization": "operation",
});

// The seven-phase folder the 8 to 10 step moves each of those stages into.
export const SEVEN_PHASE_STAGE_FOLDER: Readonly<Record<string, string>> = Object.freeze({
  "intent-capture": "discover",
  "market-research": "discover",
  feasibility: "discover",
  "scope-definition": "discover",
  "team-formation": "discover",
  "rough-mockups": "discover",
  "approval-handoff": "discover",
  "reverse-engineering": "discover",
  "practices-discovery": "design",
  "requirements-analysis": "design",
  "user-stories": "design",
  "refined-mockups": "design",
  "domain-design": "design",
  "units-generation": "design",
  "contract-design": "design",
  "delivery-planning": "design",
  "functional-design": "design",
  "nfr-requirements": "design",
  "nfr-design": "design",
  "infrastructure-design": "design",
  "code-generation": "build",
  "build-and-test": "test",
  "ci-pipeline": "deploy",
  "deployment-pipeline": "deploy",
  "environment-provisioning": "deploy",
  "deployment-execution": "deploy",
  "observability-setup": "operate",
  "incident-response": "operate",
  "performance-validation": "test",
  "feedback-optimization": "operate",
});

// The stages a five-phase record kept once per Unit, at construction/<unit>/<slug>/.
export const FIVE_PHASE_UNIT_STAGES: readonly string[] = [
  "functional-design",
  "nfr-requirements",
  "nfr-design",
  "infrastructure-design",
  "code-generation",
];

function isFivePhase(segment: string): segment is FivePhase {
  return (FIVE_PHASE_FOLDERS as readonly string[]).includes(segment);
}

/**
 * The seven-phase spelling of a recorded path that a five-phase release wrote:
 * the last `<old phase>/<slug>/` or `construction/<unit>/<unit stage>/` segment
 * pair takes the stage's seven-phase folder. A path with no such segment comes
 * back unchanged. `pluginFolder` names the old and the seven-phase folder of a
 * stage the frozen tables do not know (a plugin stage), when the caller can
 * say. Separators are read as either `/` or `\`, and the path keeps its own.
 * For equality checks only: a translated path still has to equal the current
 * one, and the content the record binds (a prompt hash, a fingerprint) is
 * checked as before.
 */
export function sevenPhaseRecordPath(
  path: string,
  pluginFolder?: (slug: string) => { old: string; current: string } | null | undefined,
): string {
  const sep = path.includes("/") || !path.includes("\\") ? "/" : "\\";
  const segments = path.split(/[\\/]/);
  for (let i = segments.length - 2; i >= 0; i--) {
    const folder = segments[i];
    if (!isFivePhase(folder)) continue;
    const slug = segments[i + 1];
    const unitStage = segments[i + 2];
    let target: string | undefined;
    if (FIVE_PHASE_STAGE_FOLDER[slug] === folder) target = SEVEN_PHASE_STAGE_FOLDER[slug];
    else if (folder === "construction" && slug !== "" && unitStage !== undefined && FIVE_PHASE_UNIT_STAGES.includes(unitStage)) {
      target = SEVEN_PHASE_STAGE_FOLDER[unitStage];
    } else if (!(slug in FIVE_PHASE_STAGE_FOLDER)) {
      const plugin = pluginFolder?.(slug);
      if (plugin && plugin.old === folder) target = plugin.current;
    }
    if (target === undefined) continue;
    segments[i] = target;
    return segments.join(sep);
  }
  return path;
}

/**
 * Whether two recorded paths name the same file once a five-phase spelling is
 * read in its seven-phase form. The current path is never translated: only a
 * five-phase release wrote the old folders, so only the recorded side can
 * carry them.
 */
export function sameRecordPath(recorded: string, current: string): boolean {
  return recorded === current || sevenPhaseRecordPath(recorded) === current;
}

/**
 * The five-phase logical path of a seven-phase review manifest entry
 * (`<phase>/<slug>/<file>` or `<phase>/<unit>/<slug>/<file>`), the form a
 * five-phase release hashed into a review or Unit receipt; null when the entry
 * names no stage that release kept. Per-Unit entries go back to
 * `construction/<unit>/<slug>/`, stage-level ones to the stage's old folder.
 */
export function fivePhaseLogicalPath(logicalPath: string): string | null {
  const segments = logicalPath.split("/");
  if (segments.length < 3) return null;
  const [phase, second, third] = segments;
  if (FIVE_PHASE_UNIT_STAGES.includes(third ?? "") && SEVEN_PHASE_STAGE_FOLDER[third] === phase && !(second in FIVE_PHASE_STAGE_FOLDER)) {
    return ["construction", ...segments.slice(1)].join("/");
  }
  const old = FIVE_PHASE_STAGE_FOLDER[second];
  if (old && SEVEN_PHASE_STAGE_FOLDER[second] === phase) return [old, ...segments.slice(1)].join("/");
  return null;
}
