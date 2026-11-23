// Where a five-phase AI-DLC (State Version 8 and earlier, up to 2.11.4) kept
// each stage's record folder, and where the seven-phase layout keeps it. One
// owner for the translation: the 8 to 10 state step moves the folders with
// it, and every reader of recorded evidence (a questions-file path on an
// approval or summary record, an audit row's File, a review manifest's
// logical paths) accepts the five-phase spelling through it, so work approved
// or reviewed before the update still holds after the move.
//
// The tables are frozen: a later release that moves a stage again adds its own
// step and never changes what this one did. A stage they do not know (a
// plugin's) is read at its phase in the stage graph, as the step's folder move
// reads it. A leaf module: it imports nothing, and reads the graph through the
// reader aidlc-lib.ts registers (registerFivePhaseStageGraph).

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

// The order 2.11.4 walked its stages in after Initialization: the key order of
// FIVE_PHASE_STAGE_FOLDER, which t-five-phase-record-paths pins against that
// release's graph.
export const FIVE_PHASE_STAGE_ORDER: readonly string[] = Object.freeze(Object.keys(FIVE_PHASE_STAGE_FOLDER));

/**
 * What the seven-phase order does to the stages around a five-phase record's
 * cursor, from stage order alone. `behind`: the stages 2.11.4 would still have
 * walked to that now come before the cursor (Performance Validation while the
 * cursor is anywhere from CI Pipeline to Incident Response, Reverse
 * Engineering from Scope Definition to Approval & Handoff). `ahead`: the ones
 * its walk had already passed that now come after it. `order` is the current
 * graph's stage order. A stage the frozen order does not know (Initialization's,
 * one a later release added, a plugin's) stands where 2.11.4's walk would have
 * reached it: just before the first stage after it in `order` that the frozen
 * order knows. A cursor `order` does not hold moves nothing.
 */
export function stagesReorderedAround(order: readonly string[], cursor: string): { behind: string[]; ahead: string[] } {
  const at = order.indexOf(cursor);
  if (at < 0) return { behind: [], ahead: [] };
  // Each stage's place in 2.11.4's walk, its current index breaking a tie
  // between the stages that stand at one frozen stage's place.
  const place = order.map((_, index) => {
    const known = order.slice(index).find((slug) => FIVE_PHASE_STAGE_ORDER.includes(slug));
    return known === undefined ? FIVE_PHASE_STAGE_ORDER.length : FIVE_PHASE_STAGE_ORDER.indexOf(known);
  });
  const walkedFirst = (a: number, b: number): boolean => place[a] < place[b] || (place[a] === place[b] && a < b);
  return {
    behind: order.filter((_, index) => index < at && walkedFirst(at, index)),
    ahead: order.filter((_, index) => index > at && walkedFirst(index, at)),
  };
}

function isFivePhase(segment: string): segment is FivePhase {
  return (FIVE_PHASE_FOLDERS as readonly string[]).includes(segment);
}

/** A stage as the stage graph has it: its phase, and whether it runs once per Unit. */
export interface FivePhaseGraphStage {
  phase: string;
  perUnit: boolean;
}

let graphStage: (slug: string) => FivePhaseGraphStage | undefined = () => undefined;

/**
 * The stage graph's reading of a slug, for a stage the frozen tables do not
 * know: every stage the graph holds, disabled ones too, at a seven-phase
 * phase. aidlc-lib.ts registers it as it loads, from the graph the 8 to 10
 * step's folder move reads.
 */
export function registerFivePhaseStageGraph(lookup: (slug: string) => FivePhaseGraphStage | undefined): void {
  graphStage = lookup;
}

// The seven-phase folder of a stage the frozen tables do not know (a
// plugin's), kept at stage level: its phase in the graph, whichever
// five-phase folder 2.11.4 kept it in.
function pluginStageFolder(slug: string): string | undefined {
  return Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, slug) ? undefined : graphStage(slug)?.phase;
}

// The seven-phase folder a per-Unit stage's Unit folders go under: the frozen
// table's for a stage 2.11.4 kept once per Unit, the graph's phase for a
// plugin stage that runs once per Unit.
function unitStageFolder(slug: string | undefined): string | undefined {
  if (slug === undefined || slug === "") return undefined;
  if (FIVE_PHASE_UNIT_STAGES.includes(slug)) return SEVEN_PHASE_STAGE_FOLDER[slug];
  if (Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, slug)) return undefined;
  const stage = graphStage(slug);
  return stage?.perUnit ? stage.phase : undefined;
}

/**
 * The seven-phase spelling of a recorded path that a five-phase release wrote:
 * the last `<old phase>/<slug>/` or `construction/<unit>/<unit stage>/` segment
 * run takes the stage's seven-phase folder. A Unit's run is read first, so a
 * Unit reads as a Unit whatever it is called (a five-phase folder's name or a
 * stage's included), as the 8 to 10 step moves its folder; a path whose last
 * `<phase>/<slug>/` or `<phase>/<unit>/<unit stage>/` run is already
 * seven-phase comes back as it is (a folder above it named like a five-phase
 * one is the project's), and so does a path with no such run. Separators are
 * read as either `/` or `\`, and the path keeps its own. For equality checks
 * only: a translated path still has to equal the current one, and the content
 * the record binds (a prompt hash, a fingerprint) is checked as before.
 */
export function sevenPhaseRecordPath(path: string): string {
  const sep = path.includes("/") || !path.includes("\\") ? "/" : "\\";
  const segments = path.split(/[\\/]/);
  for (let i = segments.length - 2; i >= 0; i--) {
    const unitFolder = i > 0 && segments[i] !== "" ? unitStageFolder(segments[i + 1]) : undefined;
    if (unitFolder !== undefined && segments[i - 1] === unitFolder) return path;
    if (unitFolder !== undefined && segments[i - 1] === "construction") {
      segments[i - 1] = unitFolder;
      return segments.join(sep);
    }
    const folder = segments[i];
    const slug = segments[i + 1];
    if (!isFivePhase(folder)) {
      const seven = Object.hasOwn(SEVEN_PHASE_STAGE_FOLDER, slug) ? SEVEN_PHASE_STAGE_FOLDER[slug] : pluginStageFolder(slug);
      if (seven !== undefined && seven === folder) return path;
      continue;
    }
    const target = Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, slug)
      ? FIVE_PHASE_STAGE_FOLDER[slug] === folder ? SEVEN_PHASE_STAGE_FOLDER[slug] : undefined
      : pluginStageFolder(slug);
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
 * `construction/<unit>/<slug>/` (read first, whatever the Unit is called, as
 * sevenPhaseRecordPath reads them), stage-level ones to the stage's old
 * folder. A plugin stage's old folder was never recorded: `pluginFolder` names
 * the one to spell it with (fivePhaseLogicalSpellings tries each), and without
 * it such a stage-level entry has no five-phase form.
 */
export function fivePhaseLogicalPath(logicalPath: string, pluginFolder?: FivePhase): string | null {
  const segments = logicalPath.split("/");
  if (segments.length < 3) return null;
  const [phase, second, third] = segments;
  if (second !== "" && unitStageFolder(third) === phase) return ["construction", ...segments.slice(1)].join("/");
  const old = Object.hasOwn(FIVE_PHASE_STAGE_FOLDER, second)
    ? SEVEN_PHASE_STAGE_FOLDER[second] === phase ? FIVE_PHASE_STAGE_FOLDER[second] : undefined
    : pluginFolder !== undefined && pluginStageFolder(second) === phase ? pluginFolder : undefined;
  return old === undefined ? null : [old, ...segments.slice(1)].join("/");
}

/**
 * The five-phase spelling of a project-relative, `/`-separated path at the
 * seven-phase layout: the first `<phase>/<slug>/` or `<phase>/<unit>/<unit
 * stage>/` run a five-phase release kept elsewhere takes that release's folder
 * (fivePhaseLogicalPath, with `pluginFolder` for a plugin stage); null when no
 * run names one. Read from the start, so a Unit named like a phase still reads
 * as a Unit. For building the value a five-phase release recorded for the same
 * documents, never for reading one.
 */
export function fivePhaseRecordPath(path: string, pluginFolder?: FivePhase): string | null {
  const segments = path.split("/");
  for (let i = 0; i + 3 <= segments.length; i++) {
    const older = fivePhaseLogicalPath(segments.slice(i).join("/"), pluginFolder);
    if (older !== null) return [...segments.slice(0, i), older].join("/");
  }
  return null;
}

// Each distinct five-phase spelling of a list of paths, one per five-phase
// folder a plugin stage among them could have been kept in (a list naming only
// stages the frozen tables know spells the same in each); null where a path
// kept its place, and no list when none moved.
function fivePhaseSpellings(
  paths: readonly string[],
  spell: (path: string, pluginFolder: FivePhase) => string | null,
): (string | null)[][] {
  const seen = new Set<string>();
  const spellings: (string | null)[][] = [];
  for (const folder of FIVE_PHASE_FOLDERS) {
    const spelled = paths.map((path) => spell(path, folder));
    const key = JSON.stringify(spelled);
    if (spelled.every((path) => path === null) || seen.has(key)) continue;
    seen.add(key);
    spellings.push(spelled);
  }
  return spellings;
}

/**
 * Review manifest entries' logical paths as each record layout a five-phase
 * release could have kept them in spelled them (fivePhaseLogicalPath): one
 * layout for the stages the frozen tables know, one per five-phase folder for
 * a plugin stage, whose 2.11.4 folder is not recorded. Every layout binds the
 * same documents, so only the one 2.11.4 hashed can equal what it recorded.
 */
export function fivePhaseLogicalSpellings(logicalPaths: readonly string[]): (string | null)[][] {
  return fivePhaseSpellings(logicalPaths, fivePhaseLogicalPath);
}

/** fivePhaseLogicalSpellings for project-relative paths (fivePhaseRecordPath). */
export function fivePhaseRecordSpellings(paths: readonly string[]): (string | null)[][] {
  return fivePhaseSpellings(paths, fivePhaseRecordPath);
}

// The five-phase forms of review fingerprints this process computed: the
// manifest of the same documents under the logical paths a five-phase release
// hashed (fivePhaseLogicalPath), over committed text and over raw bytes,
// keyed by the current fingerprint. reviewArtifactContentsFingerprint in
// aidlc-lib.ts fills it as it maps each five-phase form back to the current one
// for currentFingerprintForm; evidence that embeds a review fingerprint (a Unit
// checkpoint's) reads it to rebuild the value a five-phase release recorded.
// Only documents read in this process are here.
const FIVE_PHASE_FINGERPRINTS = new Map<string, { fingerprint: string; raw: string }>();

export function rememberFivePhaseFingerprint(current: string, forms: { fingerprint: string; raw: string }): void {
  FIVE_PHASE_FINGERPRINTS.set(current, forms);
}

/** The five-phase form of a current review fingerprint read here (its raw-bytes form with `raw`), or null. */
export function fivePhaseFingerprintForm(current: string, raw = false): string | null {
  const forms = FIVE_PHASE_FINGERPRINTS.get(current);
  return forms === undefined ? null : raw ? forms.raw : forms.fingerprint;
}
